import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import {
  assertCanvasHealthy,
  assertFrameContent,
  buildBrowserArgs,
  buildStabilitySchedule,
  isCriticalBrowserMessage,
  resolveChromiumExecutable,
  resolveStabilityProfile,
  summarizeRgbaPixels,
  summarizeStabilitySamples,
  validateStabilitySummary,
} from './capture-utils.mjs';

const nativePlatform = process.platform;
const isTermux = nativePlatform === 'android';
if (isTermux) {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE ??= 'ubuntu24.04-arm64';
}

const { chromium } = await import('@playwright/test');

const baseUrl = process.env.DRIFTWAKE_URL ?? 'http://127.0.0.1:4173';
const durationSeconds = Number(process.env.STABILITY_SECONDS ?? 1200);
const sampleSeconds = Number(process.env.STABILITY_SAMPLE_SECONDS ?? 10);
const contentSeconds = Number(process.env.STABILITY_CONTENT_SECONDS ?? 60);
const optionalNumber = (name) => process.env[name] === undefined ? undefined : Number(process.env[name]);
const stabilityProfile = resolveStabilityProfile({
  quality: process.env.STABILITY_QUALITY ?? 'low',
  viewportWidth: optionalNumber('STABILITY_VIEWPORT_WIDTH'),
  viewportHeight: optionalNumber('STABILITY_VIEWPORT_HEIGHT'),
  minimumFps: optionalNumber('STABILITY_MIN_FPS'),
  minimumRenderScale: optionalNumber('STABILITY_MIN_RENDER_SCALE'),
});
const {
  quality,
  viewportWidth,
  viewportHeight,
  minimumFps,
  minimumRenderScale,
} = stabilityProfile;
const expectedDebrisCount = quality === 'low' ? 18 : 30;
const softwareRendererFlag = process.env.STABILITY_ALLOW_SOFTWARE_RENDERER;
if (softwareRendererFlag !== undefined && softwareRendererFlag !== '0' && softwareRendererFlag !== '1') {
  throw new Error('STABILITY_ALLOW_SOFTWARE_RENDERER must be 0 or 1');
}
const allowSoftwareRenderer = softwareRendererFlag === '1';
const maximumHeapGrowthMb = Number(process.env.STABILITY_MAX_HEAP_GROWTH_MB ?? 32);
const minimumWeatherKinds = Number(
  process.env.STABILITY_MIN_WEATHER_KINDS ?? (durationSeconds >= 360 ? 4 : 1),
);
const minimumDaylightRange = Number(
  process.env.STABILITY_MIN_DAYLIGHT_RANGE ?? (durationSeconds >= 720 ? 0.9 : 0),
);
if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error('STABILITY_SECONDS must be positive');
if (!Number.isFinite(sampleSeconds) || sampleSeconds <= 0) throw new Error('STABILITY_SAMPLE_SECONDS must be positive');
if (!Number.isFinite(contentSeconds) || contentSeconds <= 0) throw new Error('STABILITY_CONTENT_SECONDS must be positive');
if (!Number.isFinite(maximumHeapGrowthMb) || maximumHeapGrowthMb < 0) {
  throw new Error('STABILITY_MAX_HEAP_GROWTH_MB must be non-negative');
}
if (!Number.isInteger(minimumWeatherKinds) || minimumWeatherKinds < 0 || minimumWeatherKinds > 4) {
  throw new Error('STABILITY_MIN_WEATHER_KINDS must be an integer from 0 to 4');
}
if (!Number.isFinite(minimumDaylightRange) || minimumDaylightRange < 0 || minimumDaylightRange > 1) {
  throw new Error('STABILITY_MIN_DAYLIGHT_RANGE must be from 0 to 1');
}
const stabilityPolicy = {
  quality,
  viewportWidth,
  viewportHeight,
  expectedDebrisCount,
  sampleSeconds,
  contentSeconds,
  minimumDurationRatio: 0.98,
  minimumSampleCoverage: 0.9,
  minimumContentSamples: 2,
  minimumFps,
  minimumRenderScale,
  allowSoftwareRenderer,
  minimumWeatherKinds,
  minimumDaylightRange,
  maximumHeapGrowthBytes: maximumHeapGrowthMb * 1024 * 1024,
};

const forceSwiftShader = process.env.DRIFTWAKE_FORCE_SWIFTSHADER === '1'
  || (isTermux && process.env.DRIFTWAKE_FORCE_SWIFTSHADER !== '0');
const prefix = process.env.PREFIX;
const chromiumPath = resolveChromiumExecutable({
  configuredPath: process.env.CHROMIUM_PATH,
  candidates: [
    ...(prefix ? [`${prefix}/bin/chromium-browser`, `${prefix}/bin/chromium`] : []),
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
});
const outputDir = new URL('../artifacts/stability/', import.meta.url);
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const outputPath = new URL(`stability-${runId}.json`, outputDir);
const latestOutputPath = new URL('latest.json', outputDir);
await mkdir(outputDir, { recursive: true });

const errors = [];
const samples = [];
const browser = await chromium.launch({
  ...(chromiumPath ? { executablePath: chromiumPath } : {}),
  headless: process.env.PLAYWRIGHT_HEADFUL !== '1',
  args: buildBrowserArgs({ forceSwiftShader }),
});

let context;
let entryResource = null;
let runtimeResource = null;
try {
  context = await browser.newContext({ viewport: { width: viewportWidth, height: viewportHeight }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    if (isCriticalBrowserMessage(message.type(), text)) errors.push(`${message.type()}: ${text}`);
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const initialResources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  entryResource = initialResources.find((name) => /\/assets\/index-[^/]+\.js(?:\?|$)|\/src\/main\.tsx(?:\?|$)/.test(name)) ?? null;
  const eagerRuntime = initialResources.find((name) => /\/DriftwakeGame(?:-[^/?]+)?\.(?:js|ts)(?:\?|$)/.test(name));
  if (eagerRuntime) throw new Error(`world runtime loaded before player intent: ${eagerRuntime}`);
  await page.locator('.primary-command:not(:disabled)').waitFor({ timeout: 45_000 });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('dialog', { name: '设置' }).waitFor({ timeout: 5_000 });
  const qualityButton = page.getByRole('button', {
    name: quality === 'high' ? '高质量' : '性能',
    exact: true,
  });
  await qualityButton.click();
  await page.waitForFunction(
    ({ requestedQuality }) => {
      const labels = requestedQuality === 'high' ? ['高质量'] : ['性能'];
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => labels.includes(candidate.textContent?.trim() ?? ''));
      return button?.getAttribute('aria-pressed') === 'true';
    },
    { requestedQuality: quality },
  );
  await page.getByRole('button', { name: '关闭设置' }).click();
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.getByRole('button', { name: '进入海面' }).waitFor({ timeout: 45_000 });
  runtimeResource = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .find((name) => /\/DriftwakeGame(?:-[^/?]+)?\.(?:js|ts)(?:\?|$)/.test(name)) ?? null);
  if (!runtimeResource) throw new Error('world runtime resource evidence is unavailable after initialization');
  await page.waitForFunction(
    ({ expectedQuality, expectedCount }) => {
      const mount = document.querySelector('.game-mount');
      return mount?.dataset.quality === expectedQuality
        && Number(mount.dataset.debrisCount) === expectedCount;
    },
    { expectedQuality: quality, expectedCount: expectedDebrisCount },
  );
  await page.getByRole('button', { name: '进入海面' }).click();
  await page.waitForTimeout(900);
  if (await page.getByRole('button', { name: '继续漂流' }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '继续漂流' }).click();
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    const mount = document.querySelector('.game-mount');
    return Boolean(canvas)
      && document.pointerLockElement === canvas
      && mount?.dataset.simulationActive === 'true';
  }, undefined, { timeout: 10_000, polling: 100 });

  const collectSample = async ({ inspectContent }, elapsedSeconds) => {
    const sample = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const mount = document.querySelector('.game-mount');
      const gl = canvas?.getContext('webgl2');
      const contextLost = !gl || gl.isContextLost();
      const debug = !contextLost ? gl.getExtension('WEBGL_debug_renderer_info') : null;
      const heap = performance.memory;
      return {
        found: Boolean(canvas),
        width: canvas?.width ?? 0,
        height: canvas?.height ?? 0,
        pageSeconds: Math.round(performance.now() / 1000),
        contextLost,
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        usedHeap: heap?.usedJSHeapSize ?? null,
        totalHeap: heap?.totalJSHeapSize ?? null,
        fps: document.querySelector('.fps-readout')?.dataset.fps ?? null,
        quality: mount?.dataset.quality ?? null,
        debrisCount: Number.parseInt(mount?.dataset.debrisCount ?? '', 10),
        weather: mount?.dataset.weather ?? null,
        daylight: Number.parseFloat(mount?.dataset.daylight ?? 'NaN'),
        environmentRisk: Number.parseFloat(mount?.dataset.environmentRisk ?? 'NaN'),
        renderScale: Number.parseFloat(mount?.dataset.renderScale ?? 'NaN'),
        pixelRatio: Number.parseFloat(mount?.dataset.pixelRatio ?? 'NaN'),
        drawCalls: Number.parseInt(mount?.dataset.drawCalls ?? '', 10),
        triangles: Number.parseInt(mount?.dataset.triangles ?? '', 10),
        geometries: Number.parseInt(mount?.dataset.geometries ?? '', 10),
        textures: Number.parseInt(mount?.dataset.textures ?? '', 10),
        pointerLocked: document.pointerLockElement === canvas,
        simulationActive: mount?.dataset.simulationActive === 'true',
      };
    });
    if (inspectContent) {
      const canvasScreenshot = await page.locator('canvas').screenshot();
      const image = PNG.sync.read(canvasScreenshot);
      sample.frame = summarizeRgbaPixels(image.data, image.width, image.height);
    } else {
      sample.frame = null;
    }
    sample.elapsedSeconds = elapsedSeconds;
    const gateLabel = `stability/${sample.elapsedSeconds}s`;
    assertCanvasHealthy(sample, gateLabel);
    if (!sample.pointerLocked || !sample.simulationActive) {
      throw new Error(`${gateLabel}: gameplay simulation is not active`);
    }
    if (sample.frame) assertFrameContent(sample.frame, gateLabel);
    samples.push(sample);
  };

  const schedule = buildStabilitySchedule({ durationSeconds, sampleSeconds, contentSeconds });
  await collectSample(schedule[0], 0);
  const startedAt = Date.now();
  for (const checkpoint of schedule.slice(1)) {
    const deadline = startedAt + checkpoint.atSeconds * 1000;
    await page.waitForTimeout(Math.max(1, deadline - Date.now()));
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    await collectSample(checkpoint, elapsedSeconds);
  }
} catch (error) {
  errors.push(`probe: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  const summary = {
    url: baseUrl,
    entryResource,
    runtimeResource,
    renderer: samples[0]?.renderer ?? null,
    forcedSwiftShader: forceSwiftShader,
    policy: stabilityPolicy,
    ...summarizeStabilitySamples(samples, { requestedSeconds: durationSeconds, errors }),
  };
  summary.failures = validateStabilitySummary(summary, stabilityPolicy);
  const evidence = `${JSON.stringify({ summary, samples }, null, 2)}\n`;
  await Promise.all([
    writeFile(outputPath, evidence, 'utf8'),
    writeFile(latestOutputPath, evidence, 'utf8'),
  ]);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Stability evidence: ${outputPath.pathname}`);
  console.log(`Latest stability evidence: ${latestOutputPath.pathname}`);
  await context?.close();
  await browser.close();
  if (summary.failures.length > 0) process.exitCode = 1;
}
