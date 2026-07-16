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
  version: 6,
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
      sailKit: 1,
      anchorKit: 1,
      planterKit: 1,
    },
    survival: { health: 92, thirst: 67, hunger: 61, oxygen: 100 },
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
    navigation: {
      windClock: 41,
      courseAngle: -Math.PI / 8,
      heading: -Math.PI / 8,
      devices: [
        { id: 'capture-sail', type: 'sail', x: 0, z: -1, rotation: 0, deployed: true },
        { id: 'capture-anchor', type: 'anchor', x: -1, z: 1, rotation: Math.PI / 2, deployed: true },
      ],
    },
    planting: {
      birdClock: 8,
      birdVisit: 0,
      planters: [
        {
          id: 'capture-planter',
          x: 1,
          z: 1,
          rotation: -Math.PI / 2,
          phase: 'growing',
          growth: 0.72,
          water: 0.44,
          drySeconds: 0,
          birdDamage: 0,
        },
      ],
    },
  },
  world: {
    island: {
      seed: 0x51ad7e,
      cycle: 0,
      phase: 'docked',
      elapsed: 78,
      nodes: [],
    },
    underwater: {
      islandSeed: 0x51ad7e,
      islandCycle: 0,
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

const underwaterSeededSave = {
  ...seededSave,
  player: {
    ...seededSave.player,
    inventory: {
      ...seededSave.player.inventory,
      purifierKit: 0,
      grillKit: 0,
      sailKit: 0,
      anchorKit: 0,
      planterKit: 0,
    },
    selectedTool: 'hook',
    navigation: { surface: 'water', x: -3.117, y: -2.3, z: 4.7 },
  },
};

const anchorInteractionSave = {
  ...seededSave,
  raft: {
    ...seededSave.raft,
    devices: seededSave.raft.devices.filter((device) => device.x !== 0 || device.z !== -1),
    navigation: {
      ...seededSave.raft.navigation,
      devices: [
        { id: 'interaction-sail', type: 'sail', x: 1, z: -1, rotation: 0, deployed: false },
        { id: 'interaction-anchor', type: 'anchor', x: 0, z: -1, rotation: 0, deployed: true },
      ],
    },
  },
};

const driftRiskSave = {
  ...islandSeededSave,
  player: {
    ...islandSeededSave.player,
    navigation: { surface: 'island', x: 0, z: -7 },
  },
  raft: {
    ...islandSeededSave.raft,
    navigation: {
      ...islandSeededSave.raft.navigation,
      devices: islandSeededSave.raft.navigation.devices.map((device) => ({ ...device, deployed: false })),
    },
  },
  world: {
    ...islandSeededSave.world,
    island: { ...islandSeededSave.world.island, elapsed: 77.85 },
  },
};

const plantingPlacementSave = {
  ...seededSave,
  player: {
    ...seededSave.player,
    inventory: {
      hook: 1,
      hammer: 1,
      palmSeed: 2,
      freshWaterCup: 1,
      planterKit: 1,
    },
  },
  raft: {
    ...seededSave.raft,
    navigation: {
      ...seededSave.raft.navigation,
      devices: [
        { id: 'planting-sail', type: 'sail', x: -1, z: -1, rotation: 0, deployed: false },
        { id: 'planting-anchor', type: 'anchor', x: -1, z: 1, rotation: Math.PI / 2, deployed: true },
      ],
    },
    planting: {
      birdClock: 0,
      birdVisit: 0,
      planters: [],
    },
  },
};

const plantingInteractionSave = {
  ...plantingPlacementSave,
  raft: {
    ...plantingPlacementSave.raft,
    planting: {
      birdClock: 0,
      birdVisit: 0,
      planters: [
        {
          id: 'interaction-planter',
          x: 1,
          z: -1,
          rotation: 0,
          phase: 'empty',
          growth: 0,
          water: 0,
          drySeconds: 0,
          birdDamage: 0,
        },
      ],
    },
  },
};

const plantingBirdSave = {
  ...plantingInteractionSave,
  raft: {
    ...plantingInteractionSave.raft,
    planting: {
      birdClock: 32.8,
      birdVisit: 0,
      birdPhase: 'feeding',
      birdElapsed: 0,
      birdTargetId: 'bird-planter',
      planters: [
        {
          id: 'bird-planter',
          x: 1,
          z: -1,
          rotation: 0,
          phase: 'mature',
          growth: 1,
          water: 0,
          drySeconds: 0,
          birdDamage: 0,
        },
      ],
    },
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
      localStorage.setItem('driftwake.save.v6', JSON.stringify(save));
    }, options.plantingBirdStart ? plantingBirdSave : options.plantingPlacementStart ? plantingPlacementSave : options.plantingStart ? plantingInteractionSave : options.driftRiskStart ? driftRiskSave : options.anchorStart ? anchorInteractionSave : options.underwaterStart ? underwaterSeededSave : options.interactionStart ? islandInteractionSave : options.islandStart ? islandSeededSave : seededSave);
  }
  const page = await context.newPage();
  monitorPage(page, label);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  } catch (error) {
    const commandState = await page.locator('.primary-command').evaluate((element) => ({
      disabled: element.disabled,
      text: element.textContent?.trim() ?? '',
      connected: element.isConnected,
    })).catch(() => ({ disabled: true, text: 'missing', connected: false }));
    const canvasState = await page.locator('canvas').evaluate((canvas) => {
      const gl = canvas.getContext('webgl2');
      return { width: canvas.width, height: canvas.height, contextLost: gl?.isContextLost() ?? true };
    }).catch(() => ({ width: 0, height: 0, contextLost: true }));
    await page.screenshot({ path: new URL('diagnostic-desktop.png', outputDir).pathname, timeout: 5_000 }).catch(() => undefined);
    const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
    throw new Error(`Game did not become ready. Command: ${JSON.stringify(commandState)}. Canvas: ${JSON.stringify(canvasState)}. Visible text: ${bodyText}`, { cause: error });
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

async function aimDownToPrompt(page, expected, steps = 50) {
  let prompt = '';
  for (let step = 0; step < steps && !prompt.includes(expected); step += 1) {
    await page.evaluate(() => {
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: { value: 0 },
        movementY: { value: 8 },
      });
      document.dispatchEvent(movement);
    });
    await page.waitForTimeout(75);
    prompt = (await page.locator('.interaction-prompt').textContent())?.trim() ?? '';
  }
  if (!prompt.includes(expected)) {
    await page.waitForFunction(
      (label) => document.querySelector('.interaction-prompt')?.textContent?.includes(label),
      expected,
      { timeout: 4_000 },
    ).catch(() => undefined);
    prompt = (await page.locator('.interaction-prompt').textContent())?.trim() ?? '';
  }
  return prompt;
}

async function capturePlantingPlacement() {
  const { context, page } = await openDesktopPage('planting-placement', { seedSave: true, plantingPlacementStart: true });
  await page.locator('.primary-command').click();
  await page.keyboard.press('KeyI');
  await page.getByRole('dialog', { name: '野外背包' }).waitFor();
  await page.getByRole('button', { name: /潮生作物盆套件/ }).click();
  await page.getByRole('button', { name: '安置到木筏' }).click();
  const placementPrompt = await aimDownToPrompt(page, '安置潮生作物盆');
  if (!placementPrompt.includes('安置潮生作物盆')) {
    await page.screenshot({ path: new URL('planting-placement-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected planter placement prompt, received: ${placementPrompt}`);
  }
  await page.mouse.click(desktopWidth / 2, desktopHeight / 2);
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('作物盆已固定'), null, { timeout: 4_000 });
  await page.locator('.device-status--planter').waitFor({ timeout: 4_000 });
  await inspectCanvasPixels(page, 'planting-placement');
  await page.screenshot({ path: new URL('planting-placement-desktop.png', outputDir).pathname });
  await context.close();
}

async function capturePlantingInteraction() {
  const { context, page } = await openDesktopPage('planting-interaction', { seedSave: true, plantingStart: true });
  await page.locator('.primary-command').click();
  await page.locator('canvas').click({ position: { x: desktopWidth / 2, y: desktopHeight / 2 } });
  let prompt = await aimDownToPrompt(page, '埋入盐冠棕榈种');
  if (!prompt.includes('埋入盐冠棕榈种')) {
    await page.waitForFunction(
      () => document.querySelector('.interaction-prompt')?.textContent?.includes('埋入盐冠棕榈种'),
      null,
      { timeout: 4_000 },
    ).catch(() => undefined);
    prompt = (await page.locator('.interaction-prompt').textContent())?.trim() ?? '';
  }
  if (!prompt.includes('埋入盐冠棕榈种')) {
    await page.screenshot({ path: new URL('planting-interaction-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected planting prompt, received: ${prompt}`);
  }
  await page.keyboard.press('KeyE');
  await page.locator('.interaction-prompt').filter({ hasText: '浇入一杯蒸馏淡水' }).waitFor({ timeout: 4_000 });
  await page.keyboard.press('KeyE');
  await page.locator('.interaction-prompt').filter({ hasText: '生长' }).waitFor({ timeout: 4_000 });
  await page.waitForFunction(
    () => document.querySelector('.device-status--planter')?.classList.contains('device-status--working'),
    null,
    { timeout: 4_000 },
  ).catch(async (error) => {
    const planterStatus = await page.locator('.device-status--planter').evaluate((element) => ({
      className: element.className,
      text: element.textContent?.trim() ?? '',
    })).catch(() => ({ className: 'missing', text: '' }));
    throw new Error(`Planter HUD did not enter working state: ${JSON.stringify(planterStatus)}`, { cause: error });
  });
  const emptyCupButton = page.getByRole('button', { name: /折边聚合杯/ });
  await page.keyboard.press('KeyI');
  await emptyCupButton.waitFor({ timeout: 4_000 });
  await page.keyboard.press('KeyI');
  await page.getByRole('button', { name: '继续漂流' }).click();
  await inspectCanvasPixels(page, 'planting-interaction');
  await page.screenshot({ path: new URL('planting-interaction-desktop.png', outputDir).pathname });
  await context.close();
}

async function capturePlantingBird() {
  const { context, page } = await openDesktopPage('planting-bird', { seedSave: true, plantingBirdStart: true });
  await page.locator('.primary-command').click();
  await page.locator('canvas').click({ position: { x: desktopWidth / 2, y: desktopHeight / 2 } });
  const birdPrompt = await aimDownToPrompt(page, '驱赶盐翼盗鸟');
  if (!birdPrompt.includes('驱赶盐翼盗鸟')) throw new Error(`Expected bird deterrence prompt, received: ${birdPrompt}`);
  await page.locator('.crop-warning.is-visible').waitFor({ timeout: 8_000 });
  await page.locator('.interaction-prompt').filter({ hasText: '驱赶盐翼盗鸟' }).waitFor({ timeout: 14_000 }).catch(async (error) => {
    await page.screenshot({ path: new URL('planting-bird-diagnostic.png', outputDir).pathname });
    const prompt = (await page.locator('.interaction-prompt').textContent())?.trim() ?? '';
    const warning = await page.locator('.crop-warning').getAttribute('class');
    throw new Error(`Bird interaction prompt missing: prompt=${prompt}; warning=${warning}`, { cause: error });
  });
  await inspectCanvasPixels(page, 'planting-bird');
  await page.screenshot({ path: new URL('planting-bird-desktop.png', outputDir).pathname });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('被惊飞'), null, { timeout: 4_000 });
  await page.waitForFunction(() => !document.querySelector('.crop-warning')?.classList.contains('is-visible'), null, { timeout: 4_000 });
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
  if (!prompt.includes('拾取风干枝料')) {
    await page.waitForFunction(
      () => document.querySelector('.interaction-prompt')?.textContent?.includes('拾取风干枝料'),
      null,
      { timeout: 20_000 },
    ).catch(() => undefined);
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

async function captureUnderwater() {
  const { context, page } = await openDesktopPage('underwater', { seedSave: true, underwaterStart: true });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(1500);
  await page.locator('.dive-readout.is-visible').waitFor();
  const oxygenLabel = await page.locator('.survival-gauge--oxygen').getAttribute('aria-label');
  const depthLabel = await page.locator('.dive-readout').getAttribute('aria-label');
  console.log(`Underwater HUD: ${oxygenLabel}; ${depthLabel}`);
  console.log(`Underwater FPS: ${(await page.locator('.fps-readout').textContent())?.trim() ?? '--'}`);
  await inspectCanvasPixels(page, 'underwater');
  await page.screenshot({ path: new URL('underwater-desktop.png', outputDir).pathname, timeout: 90_000 });
  await context.close();
}

async function captureUnderwaterInteraction() {
  const { context, page } = await openDesktopPage('underwater-interaction', { seedSave: true, underwaterStart: true });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForFunction(
    () => document.querySelector('.interaction-prompt')?.textContent?.includes('收割长叶海草'),
    null,
    { timeout: 20_000 },
  );
  const prompt = (await page.locator('.interaction-prompt').textContent())?.trim() ?? '';
  console.log(`Underwater interaction prompt: ${prompt}`);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('+2 海草'), null, { timeout: 15_000 });
  await inspectCanvasPixels(page, 'underwater-interaction');
  await page.screenshot({ path: new URL('underwater-interaction-desktop.png', outputDir).pathname, timeout: 90_000 });
  await context.close();
}

async function captureNarrow() {
  const context = await browser.newContext({ viewport: { width: 640, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript((save) => {
    localStorage.setItem('driftwake.save.v6', JSON.stringify(save));
  }, seededSave);
  const page = await context.newPage();
  monitorPage(page, 'narrow');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(900);
  const narrowBoxes = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    return {
      navigation: box('.navigation-readout'),
      hotbar: box('.hotbar'),
      devices: box('.device-rack.is-visible'),
      survival: box('.survival-cluster'),
      island: box('.island-readout'),
      actions: box('.hud-actions'),
    };
  });
  const overlaps = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
  for (const [first, second] of [
    ['navigation', 'hotbar'],
    ['navigation', 'devices'],
    ['navigation', 'survival'],
    ['devices', 'hotbar'],
    ['devices', 'island'],
    ['devices', 'actions'],
  ]) {
    if (overlaps(narrowBoxes[first], narrowBoxes[second])) {
      throw new Error(`Narrow HUD overlap: ${first} intersects ${second}; ${JSON.stringify(narrowBoxes)}`);
    }
  }
  console.log(`Narrow HUD boxes: ${JSON.stringify(narrowBoxes)}`);
  await inspectCanvasPixels(page, 'narrow');
  await page.screenshot({ path: new URL('game-narrow.png', outputDir).pathname });
  await context.close();
}

async function captureUnderwaterNarrow() {
  const context = await browser.newContext({ viewport: { width: 640, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript((save) => {
    localStorage.setItem('driftwake.save.v6', JSON.stringify(save));
  }, underwaterSeededSave);
  const page = await context.newPage();
  monitorPage(page, 'underwater-narrow');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.waitForTimeout(1200);
  await inspectCanvasPixels(page, 'underwater-narrow');
  await page.screenshot({ path: new URL('underwater-narrow.png', outputDir).pathname });
  await context.close();
}

async function captureNavigation() {
  const { context, page } = await openDesktopPage('navigation', { seedSave: true });
  await page.locator('.primary-command').click();
  await page.waitForTimeout(900);
  await page.locator('.interaction-prompt').filter({ hasText: '收起拾风帆' }).waitFor({ timeout: 8_000 });
  const courseBefore = await page.locator('.navigation-readout').getAttribute('aria-label');
  await page.keyboard.press('KeyR');
  await page.waitForFunction(
    (before) => document.querySelector('.navigation-readout')?.getAttribute('aria-label') !== before,
    courseBefore,
    { timeout: 4_000 },
  );
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !document.querySelector('.navigation-readout')?.classList.contains('is-sailing'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('.navigation-readout')?.classList.contains('is-sailing'));
  await inspectCanvasPixels(page, 'navigation');
  await page.screenshot({ path: new URL('navigation-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureNavigationInteraction() {
  const { context, page } = await openDesktopPage('navigation-interaction', { seedSave: true, anchorStart: true });
  await page.locator('.primary-command').click();
  await page.locator('canvas').click({ position: { x: desktopWidth / 2, y: desktopHeight / 2 } });
  await page.waitForTimeout(350);
  let prompt = '';
  for (let step = 0; step < 18 && !prompt.includes('起锚恢复航行'); step += 1) {
    await page.evaluate(() => {
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: { value: 0 },
        movementY: { value: 18 },
      });
      document.dispatchEvent(movement);
    });
    await page.waitForTimeout(80);
    prompt = (await page.locator('.interaction-prompt').textContent())?.trim() ?? '';
  }
  console.log(`Navigation interaction prompt: ${prompt}`);
  if (!prompt.includes('起锚恢复航行')) {
    await page.screenshot({ path: new URL('navigation-interaction-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected raised-anchor prompt, received: ${prompt}`);
  }
  await page.keyboard.press('KeyE');
  await page.locator('.interaction-prompt').filter({ hasText: '抛下潮石锚' }).waitFor({ timeout: 4_000 });
  if (await page.locator('.navigation-readout').evaluate((element) => element.classList.contains('is-anchored'))) {
    throw new Error('Anchor HUD remained active after raising the anchor');
  }
  await page.keyboard.press('KeyE');
  await page.locator('.interaction-prompt').filter({ hasText: '起锚恢复航行' }).waitFor({ timeout: 4_000 });
  await inspectCanvasPixels(page, 'navigation-interaction');
  await page.screenshot({ path: new URL('navigation-interaction-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureDriftRisk() {
  const { context, page } = await openDesktopPage('drift-risk', { seedSave: true, driftRiskStart: true });
  await page.locator('.primary-command').click();
  await page.locator('.island-readout.is-drift-risk').waitFor({ timeout: 8_000 });
  await page.locator('.island-readout--departing.is-ashore').waitFor({ timeout: 20_000 });
  await page.evaluate(() => {
    const movement = new MouseEvent('mousemove');
    Object.defineProperties(movement, {
      movementX: { value: -1780 },
      movementY: { value: 120 },
    });
    document.dispatchEvent(movement);
  });
  await page.waitForTimeout(900);
  if (await page.locator('.dive-readout').evaluate((element) => element.classList.contains('is-visible'))) {
    throw new Error('Player fell through the moving island instead of remaining in its expedition frame');
  }
  const status = (await page.locator('.island-readout strong').textContent())?.trim() ?? '';
  if (status !== '正在远离') throw new Error(`Expected island departure status, received: ${status}`);
  await inspectCanvasPixels(page, 'drift-risk');
  await page.screenshot({ path: new URL('drift-risk-desktop.png', outputDir).pathname });
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
  if (captureOnly === 'all' || captureOnly === 'planting-placement') await capturePlantingPlacement();
  if (captureOnly === 'all' || captureOnly === 'planting-interaction') await capturePlantingInteraction();
  if (captureOnly === 'all' || captureOnly === 'planting-bird') await capturePlantingBird();
  if (captureOnly === 'all' || captureOnly === 'island') await captureIsland();
  if (captureOnly === 'all' || captureOnly === 'island-interaction') await captureIslandInteraction();
  if (captureOnly === 'all' || captureOnly === 'underwater') await captureUnderwater();
  if (captureOnly === 'all' || captureOnly === 'underwater-interaction') await captureUnderwaterInteraction();
  if (captureOnly === 'all' || captureOnly === 'narrow') await captureNarrow();
  if (captureOnly === 'all' || captureOnly === 'underwater-narrow') await captureUnderwaterNarrow();
  if (captureOnly === 'all' || captureOnly === 'navigation') await captureNavigation();
  if (captureOnly === 'all' || captureOnly === 'navigation-interaction') await captureNavigationInteraction();
  if (captureOnly === 'all' || captureOnly === 'drift-risk') await captureDriftRisk();
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
