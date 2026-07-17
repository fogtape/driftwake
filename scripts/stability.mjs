import { mkdir, writeFile } from 'node:fs/promises';
import { launchDriftwakeChromium, preparePlaywrightPlatform } from './browser-runtime.mjs';
import {
  assertEncodedFrameContent,
  buildStabilitySchedule,
  isCriticalBrowserMessage,
  resolveStabilityProfile,
  summarizeStabilitySamples,
  validateStabilitySummary,
} from './capture-utils.mjs';

preparePlaywrightPlatform();
const { chromium } = await import('@playwright/test');

const optionalNumber = (name) => process.env[name] === undefined ? undefined : Number(process.env[name]);
const baseUrl = process.env.DRIFTWAKE_URL ?? 'http://127.0.0.1:4173';
const durationSeconds = Number(process.env.STABILITY_SECONDS ?? 1200);
const sampleSeconds = Number(process.env.STABILITY_SAMPLE_SECONDS ?? 10);
const contentSeconds = Number(process.env.STABILITY_CONTENT_SECONDS ?? 60);
const profile = resolveStabilityProfile({
  quality: process.env.STABILITY_QUALITY ?? 'low',
  viewportWidth: optionalNumber('STABILITY_VIEWPORT_WIDTH'),
  viewportHeight: optionalNumber('STABILITY_VIEWPORT_HEIGHT'),
  minimumFps: optionalNumber('STABILITY_MIN_FPS'),
  minimumRenderScale: optionalNumber('STABILITY_MIN_RENDER_SCALE') ?? 1,
});
const allowSoftwareRenderer = process.env.STABILITY_ALLOW_SOFTWARE_RENDERER === '1';
const exerciseMovement = process.env.STABILITY_EXERCISE_MOVEMENT !== '0';
const policy = {
  ...profile,
  sampleSeconds,
  expectedDebrisCount: profile.quality === 'high' ? 30 : 18,
  minimumDurationRatio: 0.98,
  minimumSampleCoverage: 0.9,
  minimumContentSamples: 2,
  maximumRetainedHeapGrowthBytes: Number(process.env.STABILITY_MAX_RETAINED_HEAP_MB ?? 32) * 1024 * 1024,
  maximumHeapSlopeBytesPerMinute: Number(process.env.STABILITY_MAX_HEAP_SLOPE_MB_MIN ?? 2) * 1024 * 1024,
  maximumDroppedSimulationSeconds: Number(process.env.STABILITY_MAX_DROPPED_SECONDS ?? 0.5),
  allowSoftwareRenderer,
  requireNativeFrameDriver: !allowSoftwareRenderer,
};

for (const [name, value] of Object.entries({ durationSeconds, sampleSeconds, contentSeconds })) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive`);
}

const outputDir = new URL('../artifacts/stability/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const outputPath = new URL(`stability-${runId}.json`, outputDir);
const latestPath = new URL('latest.json', outputDir);
const browserRuntime = await launchDriftwakeChromium(chromium, {
  width: profile.viewportWidth,
  height: profile.viewportHeight,
});
const errors = [];
const samples = [];
let renderer = null;
let entryResource = null;
let runtimeResource = null;

async function waitForRuntime(page, predicate, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (await page.evaluate(predicate)) return;
  throw new Error(`runtime condition timed out after ${timeout}ms`);
}

async function clickInteractable(locator) {
  const index = await locator.evaluateAll((elements) => elements.findIndex((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== 'hidden'
      && Number(style.opacity) > 0.01
      && style.pointerEvents !== 'none'
      && rect.width > 0
      && rect.height > 0;
  }));
  if (index < 0) throw new Error('no interactable control matched');
  await locator.nth(index).click({ force: true });
}

try {
  const context = await browserRuntime.browser.newContext({
    viewport: { width: profile.viewportWidth, height: profile.viewportHeight },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((quality) => {
    localStorage.setItem('driftwake.preferences.v2', JSON.stringify({
      version: 2,
      audioEnabled: false,
      muteOnFocusLoss: true,
      cameraMotionMode: 'balanced',
      quality,
      dynamicResolutionEnabled: true,
      audioMix: { master: 0, music: 0, ambience: 0, effects: 0, creatures: 0, ui: 0 },
    }));
  }, profile.quality);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (isCriticalBrowserMessage(message.type(), message.text())) {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const initial = await page.evaluate(() => ({
    canvasFound: document.querySelector('canvas') !== null,
    resources: performance.getEntriesByType('resource').map((entry) => entry.name),
  }));
  entryResource = initial.resources.find((name) => /\/assets\/index-[^/]+\.js(?:\?|$)/.test(name)) ?? null;
  const eagerRuntime = initial.resources.find((name) => /DriftwakeGame(?:-[^/?]+)?\.(?:js|ts)(?:\?|$)/.test(name));
  if (initial.canvasFound || eagerRuntime) throw new Error('world runtime loaded before player intent');

  await page.getByRole('button', { name: '开始漂流', exact: true }).click();
  const enter = page.getByRole('button', { name: '继续漂流', exact: true });
  await enter.waitFor({ timeout: 45_000 });
  runtimeResource = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .find((name) => /DriftwakeGame(?:-[^/?]+)?\.(?:js|ts)(?:\?|$)/.test(name)) ?? null);
  if (!runtimeResource) throw new Error('world runtime resource was not observed after initialization');
  await enter.click({ force: true });
  await page.waitForTimeout(700);
  await waitForRuntime(page, () => {
    const canvas = document.querySelector('canvas');
    const mount = document.querySelector('.game-mount');
    return document.pointerLockElement === canvas
      && mount?.dataset.simulationActive === 'true'
      && Number(mount.dataset.raftColliderCount) === Number(mount.dataset.raftTileCount)
      && Number(mount.dataset.raftTileCount) > 0;
  }, 30_000);

  const collectSample = async (checkpoint, elapsedSeconds) => {
    const sample = await page.evaluate((inspectContent) => {
      const canvas = document.querySelector('canvas');
      const mount = document.querySelector('.game-mount');
      const gl = canvas?.getContext('webgl2');
      const contextLost = !gl || gl.isContextLost();
      const debug = !contextLost ? gl.getExtension('WEBGL_debug_renderer_info') : null;
      const number = (key) => Number.parseFloat(mount?.dataset[key] ?? 'NaN');
      return {
        contextLost,
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        usedHeap: performance.memory?.usedJSHeapSize ?? null,
        fps: number('fps'),
        frameP95Ms: number('frameP95Ms'),
        renderScale: number('renderScale'),
        pixelRatio: number('pixelRatio'),
        drawCalls: number('drawCalls'),
        triangles: number('triangles'),
        geometries: number('geometries'),
        textures: number('textures'),
        simulationTickCount: number('simulationTickCount'),
        droppedSimulationSeconds: number('droppedSimulationSeconds'),
        raftColliderCount: number('raftColliderCount'),
        raftTileCount: number('raftTileCount'),
        debrisCount: number('debrisCount'),
        quality: mount?.dataset.quality ?? null,
        playerSurface: mount?.dataset.playerSurface ?? null,
        playerAirborne: mount?.dataset.playerAirborne === 'true',
        frameDriver: mount?.dataset.frameDriver ?? null,
        pointerLocked: document.pointerLockElement === canvas,
        simulationActive: mount?.dataset.simulationActive === 'true',
        frameContent: inspectContent && canvas ? {
          contextLost,
          width: canvas.width,
          height: canvas.height,
        } : null,
      };
    }, checkpoint.inspectContent);
    sample.elapsedSeconds = elapsedSeconds;
    if (sample.frameContent) {
      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
        optimizeForSpeed: true,
      });
      sample.frameContent.encodedBytes = Math.floor(Buffer.byteLength(screenshot.data, 'base64') * 0.75);
      assertEncodedFrameContent(sample.frameContent, `stability/${elapsedSeconds}s`);
    }
    if (!sample.pointerLocked || !sample.simulationActive || sample.contextLost) {
      throw new Error(`runtime ownership failed at ${elapsedSeconds}s`);
    }
    renderer ??= sample.renderer;
    samples.push(sample);
  };

  const exercise = async (index) => {
    if (!exerciseMovement || index === 0) return;
    const key = ['w', 'a', 's', 'd'][index % 4];
    await page.keyboard.down(key);
    await page.waitForTimeout(160);
    await page.keyboard.up(key);
    if (index % 6 === 0) await page.keyboard.press(' ');
  };

  const schedule = buildStabilitySchedule({ durationSeconds, sampleSeconds, contentSeconds });
  await collectSample(schedule[0], 0);
  const startedAt = Date.now();
  for (let index = 1; index < schedule.length; index += 1) {
    const checkpoint = schedule[index];
    const deadline = startedAt + checkpoint.atSeconds * 1000;
    await page.waitForTimeout(Math.max(1, deadline - Date.now()));
    await exercise(index);
    await collectSample(checkpoint, Math.round((Date.now() - startedAt) / 1000));
  }
  await context.close();
} catch (error) {
  errors.push(`probe: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  const summary = {
    url: baseUrl,
    entryResource,
    runtimeResource,
    renderer,
    rendererMode: browserRuntime.rendererMode,
    policy,
    ...summarizeStabilitySamples(samples, { requestedSeconds: durationSeconds, errors }),
  };
  summary.failures = validateStabilitySummary(summary, policy);
  const evidence = `${JSON.stringify({ summary, samples }, null, 2)}\n`;
  await Promise.all([
    writeFile(outputPath, evidence, 'utf8'),
    writeFile(latestPath, evidence, 'utf8'),
  ]);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Stability evidence: ${outputPath.pathname}`);
  await browserRuntime.browser.close();
  browserRuntime.cleanup();
  if (summary.failures.length > 0) process.exitCode = 1;
}
