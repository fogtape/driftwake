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
const baseUrl = process.env.DRIFTWAKE_URL ?? 'http://127.0.0.1:4173';
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
    mode: mount?.dataset.playerMode ?? null,
    collisionCount: Number.parseInt(mount?.dataset.raftCollisionCount ?? '', 10),
    headY: Number.parseFloat(mount?.dataset.playerHeadY ?? ''),
    submersionDepth: Number.parseFloat(mount?.dataset.playerSubmersion ?? ''),
    raftX: Number.parseFloat(mount?.dataset.playerRaftX ?? ''),
    raftZ: Number.parseFloat(mount?.dataset.playerRaftZ ?? ''),
    simulationActive: mount?.dataset.simulationActive ?? null,
    underwaterMix: Number.parseFloat(getComputedStyle(mount).getPropertyValue('--underwater-mix')),
    pointerLocked: Boolean(document.pointerLockElement),
    contextLost: document.querySelector('canvas')?.getContext('webgl2')?.isContextLost() ?? null,
  };
});

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.getByRole('button', { name: '进入海面' }).waitFor({ timeout: 45_000 });
  await page.getByRole('button', { name: '进入海面' }).click();
  await page.waitForFunction(
    () => document.querySelector('.game-mount')?.dataset.simulationActive === 'true',
  );

  await page.keyboard.down('KeyS');
  await page.waitForFunction(
    () => document.querySelector('.game-mount')?.dataset.playerMode === 'swimming',
    null,
    { timeout: 8_000 },
  );
  await page.keyboard.up('KeyS');
  const swimmingOutside = await readState();

  await page.keyboard.down('KeyW');
  await page.waitForFunction(
    (baseline) => Number(document.querySelector('.game-mount')?.dataset.raftCollisionCount) > baseline,
    swimmingOutside.collisionCount,
    { timeout: 12_000 },
  );
  await page.keyboard.up('KeyW');
  const surfaceBlocked = await readState();

  await page.keyboard.down('KeyC');
  await page.waitForFunction(
    () => Number(document.querySelector('.game-mount')?.dataset.playerSubmersion) > 0.55,
    null,
    { timeout: 12_000 },
  );
  await page.keyboard.up('KeyC');
  const submergedAtSide = await readState();

  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyC');
  await page.waitForFunction(
    () => Number(document.querySelector('.game-mount')?.dataset.playerRaftZ) < -2.35,
    null,
    { timeout: 18_000 },
  );
  await page.keyboard.up('KeyC');
  await page.keyboard.up('KeyW');
  const passedBelow = await readState();

  await page.waitForFunction(
    () => Number(document.querySelector('.game-mount')?.dataset.playerSubmersion) < -0.25,
    null,
    { timeout: 12_000 },
  );
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    () => document.querySelector('.game-mount')?.dataset.playerMode === 'raft',
    null,
    { timeout: 4_000 },
  );
  const climbedBack = await readState();

  const result = {
    url: baseUrl,
    swimmingOutside,
    surfaceBlocked,
    submergedAtSide,
    passedBelow,
    climbedBack,
    errors,
  };
  console.log(JSON.stringify(result, null, 2));

  if (!Number.isFinite(swimmingOutside.collisionCount)) {
    throw new Error('collision diagnostic is unavailable');
  }
  if (surfaceBlocked.collisionCount <= swimmingOutside.collisionCount || surfaceBlocked.raftZ < 2.3) {
    throw new Error('surface approach did not stop at the raft collider');
  }
  if (submergedAtSide.submersionDepth < 0.55 || submergedAtSide.underwaterMix < 0.5) {
    throw new Error('dive did not enter the underwater state');
  }
  if (passedBelow.raftZ >= -2.35) {
    throw new Error('deep passage did not reach the opposite raft edge');
  }
  if (climbedBack.mode !== 'raft' || climbedBack.simulationActive !== 'true') {
    throw new Error('climb-back flow did not recover');
  }
  if (!climbedBack.pointerLocked || climbedBack.contextLost !== false) {
    throw new Error('runtime ownership or WebGL health was lost');
  }
  if (errors.length > 0) throw new Error(`critical browser errors: ${errors.join(' | ')}`);
} finally {
  await context.close();
  await browser.close();
}
