import {
  buildBrowserArgs,
  isCriticalBrowserMessage,
  resolveChromiumExecutable,
} from './capture-utils.mjs';

const nativePlatform = process.platform;
const isTermux = nativePlatform === 'android';
if (isTermux) {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE ??= 'ubuntu24.04-arm64';
}

const { chromium } = await import('@playwright/test');
const configuredUrl = process.env.DRIFTWAKE_URL ?? 'http://127.0.0.1:4173';
const targetUrl = new URL(configuredUrl);
targetUrl.searchParams.set('environmentOffset', '315');
const forceSwiftShader = process.env.DRIFTWAKE_FORCE_SWIFTSHADER === '1'
  || (isTermux && process.env.DRIFTWAKE_FORCE_SWIFTSHADER !== '0');
const maxTiltStepDegrees = (0.7 / 60) * (180 / Math.PI);
const tiltStepToleranceDegrees = 0.01;
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

const browser = await chromium.launch({
  ...(chromiumPath ? { executablePath: chromiumPath } : {}),
  headless: process.env.PLAYWRIGHT_HEADFUL !== '1',
  args: buildBrowserArgs({ forceSwiftShader }),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  const text = message.text();
  if (isCriticalBrowserMessage(message.type(), text)) errors.push(`console: ${text}`);
});

const readState = () => page.evaluate(() => {
  const mount = document.querySelector('.game-mount');
  return {
    tiltDegrees: Number.parseFloat(mount?.dataset.cameraRaftTiltDegrees ?? ''),
    peakStepDegrees: Number.parseFloat(mount?.dataset.cameraRaftTiltPeakStepDegrees ?? ''),
    motionEnabled: mount?.dataset.cameraMotionEnabled ?? null,
    weather: mount?.dataset.weather ?? null,
    simulationActive: mount?.dataset.simulationActive ?? null,
    pointerLocked: Boolean(document.pointerLockElement),
    contextLost: document.querySelector('canvas')?.getContext('webgl2')?.isContextLost() ?? null,
  };
});

async function waitForTilt({ motionEnabled, minimum, maximum }) {
  await page.waitForFunction(
    ({ expectedMotion, minTilt, maxTilt }) => {
      const mount = document.querySelector('.game-mount');
      const tilt = Number.parseFloat(mount?.dataset.cameraRaftTiltDegrees ?? '');
      return mount?.dataset.cameraMotionEnabled === expectedMotion
        && Number.isFinite(tilt)
        && tilt >= minTilt
        && tilt <= maxTilt;
    },
    {
      expectedMotion: String(motionEnabled),
      minTilt: minimum,
      maxTilt: maximum,
    },
    { timeout: 18_000 },
  );
}

async function setMotionThroughSettings(enabled) {
  await page.keyboard.press('Escape');
  if (await page.evaluate(() => document.pointerLockElement !== null)) {
    await page.evaluate(() => document.exitPointerLock());
  }
  await page.waitForFunction(() => document.pointerLockElement === null, undefined, { timeout: 5_000 });
  await page.getByRole('button', { name: '继续漂流' }).waitFor({ timeout: 5_000 });
  await page.getByRole('button', { name: '设置' }).click();
  const toggle = page.getByRole('switch', { name: '镜头摇晃' });
  await toggle.waitFor({ timeout: 5_000 });
  await page.getByText('关闭后稳定步行起伏与木筏倾斜', { exact: true }).waitFor({ timeout: 5_000 });
  const checked = await toggle.getAttribute('aria-checked');
  if ((checked === 'true') !== enabled) await toggle.click();
  if (await toggle.getAttribute('aria-checked') !== String(enabled)) {
    throw new Error(`motion comfort toggle did not become ${enabled}`);
  }
  await page.getByRole('button', { name: '关闭设置' }).click();
  await page.getByRole('button', { name: '继续漂流' }).click();
  await page.waitForFunction(
    () => document.querySelector('.game-mount')?.dataset.simulationActive === 'true',
    undefined,
    { timeout: 5_000 },
  );
}

try {
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.getByRole('button', { name: '进入海面' }).waitFor({ timeout: 45_000 });
  await page.getByRole('button', { name: '进入海面' }).click();
  await page.waitForFunction(
    () => document.querySelector('.game-mount')?.dataset.simulationActive === 'true',
  );
  await page.waitForFunction(
    () => document.querySelector('.game-mount')?.dataset.weather === 'storm',
    undefined,
    { timeout: 8_000 },
  );

  await waitForTilt({ motionEnabled: true, minimum: 0.25, maximum: 8 });
  const enabled = await readState();

  await setMotionThroughSettings(false);
  await waitForTilt({ motionEnabled: false, minimum: 0, maximum: 0.1 });
  const disabled = await readState();

  await setMotionThroughSettings(true);
  await waitForTilt({ motionEnabled: true, minimum: 0.25, maximum: 8 });
  const restored = await readState();

  const checkpoints = { enabled, disabled, restored };
  const result = {
    url: targetUrl.toString(),
    maxTiltStepDegrees,
    checkpoints,
    errors,
  };
  console.log(JSON.stringify(result, null, 2));

  if (enabled.tiltDegrees <= disabled.tiltDegrees || restored.tiltDegrees <= disabled.tiltDegrees) {
    throw new Error('motion comfort toggle did not materially change raft camera tilt');
  }
  for (const [label, state] of Object.entries(checkpoints)) {
    if (!Number.isFinite(state.peakStepDegrees)) {
      throw new Error(`${label} did not publish a finite peak tilt step`);
    }
    if (state.peakStepDegrees > maxTiltStepDegrees + tiltStepToleranceDegrees) {
      throw new Error(
        `${label} exceeded camera tilt step cap: ${state.peakStepDegrees}° > ${maxTiltStepDegrees.toFixed(3)}°`,
      );
    }
  }
  if (enabled.peakStepDegrees <= 0) {
    throw new Error('camera tilt peak-step diagnostic never observed motion');
  }
  if (!restored.pointerLocked || restored.simulationActive !== 'true' || restored.contextLost !== false) {
    throw new Error('runtime ownership or WebGL health was lost');
  }
  if (errors.length > 0) throw new Error(`critical browser errors: ${errors.join(' | ')}`);
} finally {
  await context.close();
  await browser.close();
}
