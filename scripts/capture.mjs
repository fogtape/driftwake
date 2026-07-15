import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const isAndroid = process.platform === 'android';
if (isAndroid) {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE ??= 'ubuntu24.04-arm64';
}

const { chromium } = await import('@playwright/test');

const baseUrl = process.env.DRIFTWAKE_URL ?? 'http://127.0.0.1:4173';
const captureOnly = process.env.CAPTURE_ONLY ?? 'all';
const desktopWidth = Number(process.env.CAPTURE_WIDTH ?? 1440);
const desktopHeight = Number(process.env.CAPTURE_HEIGHT ?? 900);
const chromiumPath = process.env.CHROMIUM_PATH ?? '/data/data/com.termux/files/usr/bin/chromium-browser';
const outputDir = new URL('../artifacts/screenshots/', import.meta.url);

const seededSave = {
  version: 3,
  savedAt: 1,
  player: {
    inventory: {
      hook: 1,
      hammer: 1,
      spear: 1,
      fishingRod: 1,
      axe: 1,
      timber: 18,
      polymer: 12,
      fiber: 14,
      scrap: 4,
      rope: 5,
      stone: 6,
      palmSeed: 2,
      palmFruit: 3,
      emergencyWater: 2,
      rawFish: 1,
      cookedFish: 1,
      emptyCup: 1,
      freshWaterCup: 1,
      purifierKit: 1,
      grillKit: 1,
    },
    survival: { health: 92, thirst: 67, hunger: 61 },
    selectedTool: 'hook',
    playSeconds: 180,
    navigation: { surface: 'raft', x: 0, z: 1.08 },
  },
  raft: {
    tiles: Array.from({ length: 9 }, (_, index) => ({
      x: (index % 3) - 1,
      z: Math.floor(index / 3) - 1,
      health: index === 2 ? 66 : 100,
    })),
    devices: [
      { id: 'capture-purifier', type: 'purifier', x: -1, z: 0, rotation: 0, phase: 'ready', elapsed: 18 },
      { id: 'capture-grill', type: 'grill', x: 1, z: 0, rotation: Math.PI, phase: 'working', elapsed: 8 },
    ],
  },
  world: {
    island: {
      seed: 0x51ad7e,
      cycle: 0,
      phase: 'docked',
      elapsed: 78,
      nodes: [],
    },
  },
};

const islandSeededSave = {
  ...seededSave,
  player: {
    ...seededSave.player,
    selectedTool: 'axe',
    navigation: { surface: 'island', x: 0, z: -2 },
  },
};

const islandInteractionSave = {
  ...islandSeededSave,
  player: {
    ...islandSeededSave.player,
    navigation: { surface: 'island', x: 0.568, z: -2 },
  },
};

await mkdir(outputDir, { recursive: true });

async function startVirtualDisplay() {
  const display = `:${100 + (process.pid % 400)}`;
  const server = spawn(
    'Xvfb',
    [display, '-screen', '0', `${Math.max(1440, desktopWidth)}x${Math.max(900, desktopHeight)}x24`, '-nolisten', 'tcp', '-ac'],
    { stdio: 'ignore' },
  );
  await new Promise((resolve, reject) => {
    let timer;
    const onError = (error) => {
      clearTimeout(timer);
      reject(error);
    };
    timer = setTimeout(() => {
      server.off('error', onError);
      if (server.exitCode === null) resolve();
      else reject(new Error(`Xvfb exited with code ${server.exitCode}`));
    }, 500);
    server.once('error', onError);
  });
  process.env.DISPLAY = display;
  console.log(`Using virtual display ${display} for WebGL capture`);
  return server;
}

const autoVirtualDisplay = isAndroid && !process.env.DISPLAY && process.env.PLAYWRIGHT_HEADFUL !== '0';
const virtualDisplay = autoVirtualDisplay ? await startVirtualDisplay() : null;
const stopVirtualDisplay = () => {
  if (virtualDisplay?.exitCode === null) virtualDisplay.kill('SIGTERM');
};
process.once('exit', stopVirtualDisplay);
const headless = virtualDisplay ? false : process.env.PLAYWRIGHT_HEADFUL !== '1';
const renderingArgs = headless
  ? ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader-webgl']
  : ['--use-gl=angle', '--use-angle=gles'];

const browser = await chromium.launch({
  executablePath: chromiumPath,
  headless,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu-sandbox',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    ...renderingArgs,
  ],
});

const errors = [];

function monitorPage(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'warning') {
      console.warn(`${label} warning: ${message.text()}`);
      return;
    }
    if (message.type() !== 'error') return;
    const line = `${label} console: ${message.text()}`;
    errors.push(line);
    console.error(line);
  });
  page.on('pageerror', (error) => {
    const line = `${label} page: ${error.message}`;
    errors.push(line);
    console.error(line);
  });
}

async function openDesktopPage(label, options = {}) {
  const context = await browser.newContext({
    viewport: { width: desktopWidth, height: desktopHeight },
    deviceScaleFactor: 1,
  });
  if (options.seedSave) {
    await context.addInitScript((save) => {
      localStorage.setItem('driftwake.save.v3', JSON.stringify(save));
    }, options.interactionStart ? islandInteractionSave : options.islandStart ? islandSeededSave : seededSave);
  }
  const page = await context.newPage();
  monitorPage(page, label);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  } catch (error) {
    await page.screenshot({ path: new URL('diagnostic-desktop.png', outputDir).pathname });
    const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
    throw new Error(`Game did not become ready. Visible text: ${bodyText}`, { cause: error });
  }
  await page.waitForTimeout(250);
  return { context, page };
}

async function inspectCanvasPixels(page, label) {
  const result = await page.locator('canvas').evaluate(
    (canvas) =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          const gl = canvas.getContext('webgl2');
          if (!gl || gl.isContextLost()) {
            resolve({ contextLost: true, variation: 0, nonBlack: 0 });
            return;
          }
          const width = Math.min(24, canvas.width);
          const height = Math.min(24, canvas.height);
          const pixels = new Uint8Array(width * height * 4);
          const anchors = [
            [0.2, 0.2],
            [0.8, 0.2],
            [0.5, 0.5],
            [0.2, 0.8],
            [0.8, 0.8],
          ];
          let min = 255;
          let max = 0;
          let nonBlack = 0;
          for (const [anchorX, anchorY] of anchors) {
            gl.readPixels(
              Math.max(0, Math.floor(canvas.width * anchorX - width / 2)),
              Math.max(0, Math.floor(canvas.height * anchorY - height / 2)),
              width,
              height,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixels,
            );
            for (let index = 0; index < pixels.length; index += 4) {
              const luminance = pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
              min = Math.min(min, luminance);
              max = Math.max(max, luminance);
              if (luminance > 4) nonBlack += 1;
            }
          }
          resolve({ contextLost: false, variation: Math.round(max - min), nonBlack });
        });
      }),
  );
  console.log(`${label} canvas pixels: ${JSON.stringify(result)}`);
  if (result.contextLost || result.variation < 4 || result.nonBlack < 32) {
    throw new Error(`${label} canvas is blank or unavailable: ${JSON.stringify(result)}`);
  }
}

async function captureTitle() {
  const { context, page } = await openDesktopPage('title');
  const buttonStyle = await page.locator('.primary-command').evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    disabled: element.disabled,
  }));
  console.log(`Title command: ${JSON.stringify(buttonStyle)}`);
  const titleCanvasState = await page.locator('canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2');
    return { width: canvas.width, height: canvas.height, contextLost: gl?.isContextLost() ?? true };
  });
  console.log(`Title canvas before capture: ${JSON.stringify(titleCanvasState)}`);
  await page.screenshot({ path: new URL('title-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureGame() {
  const { context, page } = await openDesktopPage('game');
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(2200);
  const canvasState = await page.locator('canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2');
    return { width: canvas.width, height: canvas.height, contextLost: gl?.isContextLost() ?? true };
  });
  console.log(`Game canvas before capture: ${JSON.stringify(canvasState)}`);
  await inspectCanvasPixels(page, 'game');
  await page.screenshot({ path: new URL('game-desktop.png', outputDir).pathname });
  await context.close();
}

async function capturePack() {
  const { context, page } = await openDesktopPage('pack', { seedSave: true });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyI');
  await page.getByRole('dialog', { name: '野外背包' }).waitFor();
  await page.getByRole('button', { name: /潮汐净水器套件/ }).click();
  await page.screenshot({ path: new URL('pack-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureCrafting() {
  const { context, page } = await openDesktopPage('crafting', { seedSave: true });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyC');
  await page.getByRole('dialog', { name: '野外背包' }).waitFor();
  await page.screenshot({ path: new URL('crafting-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureSettings() {
  const { context, page } = await openDesktopPage('settings');
  await page.getByRole('button', { name: '设置' }).first().click();
  await page.getByRole('dialog', { name: '设置' }).waitFor();
  await page.screenshot({ path: new URL('settings-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureDevices() {
  const { context, page } = await openDesktopPage('devices', { seedSave: true });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: new URL('devices-hud-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureIsland() {
  const { context, page } = await openDesktopPage('island', { seedSave: true, islandStart: true });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(1200);
  await inspectCanvasPixels(page, 'island');
  await page.screenshot({ path: new URL('island-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureIslandInteraction() {
  const { context, page } = await openDesktopPage('island-interaction', { seedSave: true, interactionStart: true });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(650);
  let prompt = '';
  for (let step = 0; step < 14 && !prompt.includes('拾取风干枝料'); step += 1) {
    await page.evaluate(() => {
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: { value: 0 },
        movementY: { value: 24 },
      });
      document.dispatchEvent(movement);
    });
    await page.waitForTimeout(90);
    prompt = (await page.locator('.interaction-prompt').textContent())?.trim() ?? '';
  }
  console.log(`Island interaction prompt: ${prompt}`);
  if (!prompt.includes('拾取风干枝料')) {
    await page.screenshot({ path: new URL('island-interaction-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected branch gathering prompt, received: ${prompt}`);
  }
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('+2 漂木'));
  await inspectCanvasPixels(page, 'island-interaction');
  await page.screenshot({ path: new URL('island-interaction-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureNarrow() {
  const context = await browser.newContext({ viewport: { width: 640, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript((save) => {
    localStorage.setItem('driftwake.save.v3', JSON.stringify(save));
  }, seededSave);
  const page = await context.newPage();
  monitorPage(page, 'narrow');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(900);
  await inspectCanvasPixels(page, 'narrow');
  await page.screenshot({ path: new URL('game-narrow.png', outputDir).pathname });
  await context.close();
}

async function captureHook() {
  const { context, page } = await openDesktopPage('hook');
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(900);
  if (await page.getByRole('button', { name: '继续漂流' }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '继续漂流' }).click();
  }
  await page.mouse.move(760, 430);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await page.waitForTimeout(450);
  await page.screenshot({ path: new URL('hook-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureMobile() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  monitorPage(page, 'mobile');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: new URL('capability-mobile.png', outputDir).pathname });
  await context.close();
}

try {
  if (captureOnly === 'all' || captureOnly === 'title') await captureTitle();
  if (captureOnly === 'all' || captureOnly === 'game') await captureGame();
  if (captureOnly === 'all' || captureOnly === 'hook') await captureHook();
  if (captureOnly === 'all' || captureOnly === 'pack') await capturePack();
  if (captureOnly === 'all' || captureOnly === 'crafting') await captureCrafting();
  if (captureOnly === 'all' || captureOnly === 'settings') await captureSettings();
  if (captureOnly === 'all' || captureOnly === 'devices') await captureDevices();
  if (captureOnly === 'all' || captureOnly === 'island') await captureIsland();
  if (captureOnly === 'all' || captureOnly === 'island-interaction') await captureIslandInteraction();
  if (captureOnly === 'all' || captureOnly === 'narrow') await captureNarrow();
  if (captureOnly === 'all' || captureOnly === 'mobile') await captureMobile();
} finally {
  await browser.close();
  stopVirtualDisplay();
  process.off('exit', stopVirtualDisplay);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Captured Driftwake at ${baseUrl}`);
}
