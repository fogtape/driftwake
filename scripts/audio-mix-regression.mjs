import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { launchDriftwakeChromium, preparePlaywrightPlatform } from './browser-runtime.mjs';

preparePlaywrightPlatform();
const { chromium } = await import('@playwright/test');

const baseUrl = process.env.DRIFTWAKE_URL ?? 'http://127.0.0.1:4173';
const runtime = await launchDriftwakeChromium(chromium, { width: 1024, height: 640 });
const errors = [];

async function waitForRuntime(page, predicate, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`audio runtime condition timed out after ${timeout}ms`);
}

function assertMasteringDiagnostics(diagnostics, label) {
  if (!diagnostics?.graphReady || !diagnostics.limiter?.ready) {
    throw new Error(`${label}: audio graph or limiter was not ready: ${JSON.stringify(diagnostics)}`);
  }
  const expected = { threshold: -10, knee: 5, ratio: 12, attack: 0.003, release: 0.2 };
  for (const [key, value] of Object.entries(expected)) {
    if (diagnostics.limiter[key] !== value) {
      throw new Error(`${label}: limiter ${key} was ${diagnostics.limiter[key]}, expected ${value}`);
    }
  }
  if (diagnostics.contextState !== 'running') {
    throw new Error(`${label}: audio context was ${diagnostics.contextState}, expected running`);
  }
}

try {
  const context = await runtime.browser.newContext({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('driftwake.preferences.v3', JSON.stringify({
      version: 3,
      audioEnabled: true,
      muteOnFocusLoss: true,
      cameraMotionMode: 'balanced',
      quality: 'low',
      dynamicResolutionEnabled: true,
      subtitlesEnabled: true,
      colorVisionMode: 'standard',
      reducedMotion: false,
      keyBindings: {},
      audioMix: { master: 0.78, music: 0.2, ambience: 0.43, effects: 0.72, creatures: 0.78, ui: 0.56 },
    }));
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(开始漂流|开始新航次|继续航次|恢复航次|重建航次)$/ }).click();
  const enter = page.getByRole('button', { name: '继续漂流', exact: true });
  await enter.waitFor({ timeout: 45_000 });
  await page.bringToFront();
  await enter.click({ force: true });
  await waitForRuntime(page, () => {
    const mount = document.querySelector('.game-mount');
    if (mount?.dataset.simulationActive !== 'true') return false;
    try {
      return JSON.parse(mount.dataset.audioMixDiagnostics ?? 'null')?.graphReady === true;
    } catch {
      return false;
    }
  });

  const running = await page.locator('.game-mount').evaluate((mount) => JSON.parse(mount.dataset.audioMixDiagnostics ?? 'null'));
  assertMasteringDiagnostics(running, 'running');

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await waitForRuntime(page, () => {
    const mount = document.querySelector('.game-mount');
    try {
      const diagnostics = JSON.parse(mount?.dataset.audioMixDiagnostics ?? 'null');
      return mount?.dataset.audioFocusMuted === 'true'
        && diagnostics?.focusMuted === true
        && diagnostics?.masterTargetGain === 0;
    } catch {
      return false;
    }
  });
  const muted = await page.locator('.game-mount').evaluate((mount) => JSON.parse(mount.dataset.audioMixDiagnostics ?? 'null'));

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: '继续漂流' }).filter({ visible: true }).click({ force: true });
  await waitForRuntime(page, () => {
    const mount = document.querySelector('.game-mount');
    try {
      const diagnostics = JSON.parse(mount?.dataset.audioMixDiagnostics ?? 'null');
      return mount?.dataset.simulationActive === 'true'
        && mount?.dataset.audioFocusMuted === 'false'
        && diagnostics?.focusMuted === false
        && diagnostics?.masterTargetGain === 0.78;
    } catch {
      return false;
    }
  });
  const resumed = await page.locator('.game-mount').evaluate((mount) => JSON.parse(mount.dataset.audioMixDiagnostics ?? 'null'));
  assertMasteringDiagnostics(resumed, 'resumed');
  if (errors.length > 0) throw new Error(errors.join(' | '));

  const evidence = {
    status: 'passed',
    rendererMode: runtime.rendererMode,
    running,
    muted,
    resumed,
    errors,
  };
  console.log(JSON.stringify(evidence, null, 2));
  if (process.env.AUDIO_MIX_EVIDENCE_PATH) {
    const evidencePath = resolve(process.env.AUDIO_MIX_EVIDENCE_PATH);
    await mkdir(dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }
  await context.close();
} finally {
  await runtime.browser.close();
  runtime.cleanup();
}
