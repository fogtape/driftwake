import { launchDriftwakeChromium, preparePlaywrightPlatform } from './browser-runtime.mjs';
import { assertFrameContent } from './capture-utils.mjs';

preparePlaywrightPlatform();
const { chromium } = await import('@playwright/test');

const baseUrl = process.env.DRIFTWAKE_URL ?? 'http://127.0.0.1:4173';
const realContextLoss = process.env.M1_REAL_CONTEXT_LOSS === '1';
const runtime = await launchDriftwakeChromium(chromium, { width: 1280, height: 720 });
const errors = [];
let injectingContextFailure = false;

async function waitForRuntime(page, predicate, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (await page.evaluate(predicate)) return;
  throw new Error(`runtime condition timed out after ${timeout}ms`);
}

async function clickInteractable(locator) {
  await locator.evaluateAll((elements) => {
    const target = elements.find((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden'
        && Number(style.opacity) > 0.01
        && style.pointerEvents !== 'none'
        && rect.width > 0
        && rect.height > 0;
    });
    if (!(target instanceof HTMLElement)) throw new Error('no interactable control matched');
    target.click();
  });
}

try {
  const context = await runtime.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('driftwake.preferences.v2', JSON.stringify({
      version: 2,
      audioEnabled: false,
      muteOnFocusLoss: true,
      cameraMotionMode: 'balanced',
      quality: 'low',
      dynamicResolutionEnabled: true,
      audioMix: { master: 0, music: 0, ambience: 0, effects: 0, creatures: 0, ui: 0 },
    }));
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !injectingContextFailure) errors.push(`console: ${text}`);
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const titleGate = await page.evaluate(() => ({
    canvasFound: Boolean(document.querySelector('canvas')),
    worldLoaded: performance.getEntriesByType('resource')
      .some((entry) => /DriftwakeGame(?:-[^/?]+)?\.(?:js|ts)(?:\?|$)/.test(entry.name)),
  }));
  if (titleGate.canvasFound || titleGate.worldLoaded) throw new Error('title eagerly initialized the world');

  await page.getByRole('button', { name: '开始漂流', exact: true }).click();
  const enter = page.getByRole('button', { name: '继续漂流', exact: true });
  await enter.waitFor({ timeout: 45_000 });
  await page.bringToFront();
  await enter.click({ force: true });
  await page.waitForTimeout(650);
  await waitForRuntime(
    page,
    () => document.querySelector('.game-mount')?.dataset.simulationActive === 'true',
    20_000,
  ).catch(async (error) => {
    const state = await page.evaluate(() => ({
      simulationActive: document.querySelector('.game-mount')?.dataset.simulationActive,
      contextHealthy: document.querySelector('.game-mount')?.dataset.contextHealthy,
      pointerLocked: Boolean(document.pointerLockElement),
      visibility: document.visibilityState,
      focused: document.hasFocus(),
    }));
    throw new Error(`game did not enter simulation: ${JSON.stringify(state)}`, { cause: error });
  });

  const tickCountBeforeJump = Number(await page.locator('.game-mount').getAttribute('data-simulation-tick-count'));
  await page.keyboard.down(' ');
  await waitForRuntime(
    page,
    () => document.querySelector('.game-mount')?.dataset.playerAirborne === 'true',
    3_000,
  ).catch(async (error) => {
    const state = await page.evaluate(() => ({
      airborne: document.querySelector('.game-mount')?.dataset.playerAirborne,
      jumps: document.querySelector('.game-mount')?.dataset.playerJumpCount,
      surface: document.querySelector('.game-mount')?.dataset.playerSurface,
      inputEnabled: document.querySelector('.game-mount')?.dataset.playerInputEnabled,
      playerKeyboardEvents: document.querySelector('.game-mount')?.dataset.playerKeyboardEventCount,
      jumpState: document.querySelector('.game-mount')?.dataset.playerJumpState,
      simulationTicks: document.querySelector('.game-mount')?.dataset.simulationTickCount,
      gameLastKeyDown: document.querySelector('.game-mount')?.dataset.lastKeyDown,
      active: document.querySelector('.game-mount')?.dataset.simulationActive,
      pointerLocked: Boolean(document.pointerLockElement),
    }));
    throw new Error(`jump did not become airborne: ${JSON.stringify({ ...state, tickCountBeforeJump, errors })}`, { cause: error });
  });
  await page.keyboard.up(' ');
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.playerAirborne === 'false', 8_000)
    .catch(async (error) => {
      const state = await page.evaluate(() => {
        const mount = document.querySelector('.game-mount');
        return {
          airborne: mount?.dataset.playerAirborne,
          headY: mount?.dataset.playerVerticalHeadY,
          velocityY: mount?.dataset.playerVerticalVelocityY,
          simulationTicks: mount?.dataset.simulationTickCount,
          frameDriver: mount?.dataset.frameDriver,
          jumpState: mount?.dataset.playerJumpState,
        };
      });
      throw new Error(`jump did not land: ${JSON.stringify({ ...state, tickCountBeforeJump })}`, { cause: error });
    });
  console.log('m1 runtime: jump passed');

  await page.keyboard.press('Escape');
  await waitForRuntime(page, () => !document.pointerLockElement, 1_500).catch(async () => {
    await page.evaluate(() => document.exitPointerLock());
    await waitForRuntime(page, () => !document.pointerLockElement, 3_000);
  });
  await clickInteractable(page.getByRole('button', { name: '设置', exact: true }));
  await waitForRuntime(page, () => Boolean(document.querySelector('.settings-panel')));
  await clickInteractable(page.getByRole('button', { name: '舒适', exact: true }));
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.cameraMotionMode === 'comfort');
  await clickInteractable(page.getByRole('button', { name: '平衡', exact: true }));
  await clickInteractable(page.getByRole('button', { name: '关闭设置' }));
  await waitForRuntime(page, () => !document.querySelector('.settings-panel'));
  await page.getByRole('button', { name: '继续漂流' }).filter({ visible: true }).click({ force: true });
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.simulationActive === 'true');
  console.log('m1 runtime: camera settings passed');

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.simulationActive === 'false');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: '继续漂流' }).filter({ visible: true }).click({ force: true });
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.simulationActive === 'true');
  console.log('m1 runtime: focus gate passed');

  injectingContextFailure = true;
  if (realContextLoss) {
    await page.evaluate(() => {
      const extension = document.querySelector('canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      window.__driftwakeContextFailureExtension = extension;
      extension?.loseContext();
    });
  } else {
    await page.locator('canvas').evaluate((canvas) => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
  }
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.contextHealthy === 'false');
  const recoveryUi = await page.evaluate(() => ({
    canvasCount: document.querySelectorAll('canvas').length,
    resumeDisabled: document.querySelector('.focus-prompt__resume')?.disabled ?? false,
    status: document.querySelector('.focus-prompt__status')?.textContent?.trim() ?? '',
  }));
  if (recoveryUi.canvasCount !== 1 || !recoveryUi.resumeDisabled || !recoveryUi.status.includes('图形海况恢复中')) {
    throw new Error(`context recovery UI is unsafe: ${JSON.stringify(recoveryUi)}`);
  }
  if (realContextLoss) {
    await page.evaluate(() => window.__driftwakeContextFailureExtension?.restoreContext());
  } else {
    await page.locator('canvas').evaluate((canvas) => {
      canvas.dispatchEvent(new Event('webglcontextrestored'));
    });
  }
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.contextHealthy === 'true', 10_000);
  injectingContextFailure = false;
  await page.getByRole('button', { name: '继续漂流' }).filter({ visible: true }).click({ force: true });
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.simulationActive === 'true');
  console.log('m1 runtime: context restore passed');

  const finalState = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const mount = document.querySelector('.game-mount');
    const gl = canvas?.getContext('webgl2');
    if (!canvas || !gl || gl.isContextLost()) return { contextLost: true, variation: 0, nonBlack: 0 };
    const pixels = new Uint8Array(24 * 24 * 4);
    gl.readPixels(Math.floor(canvas.width / 2) - 12, Math.floor(canvas.height / 2) - 12, 24, 24, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let minimum = 255;
    let maximum = 0;
    let nonBlack = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance = pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
      minimum = Math.min(minimum, luminance);
      maximum = Math.max(maximum, luminance);
      if (luminance > 4) nonBlack += 1;
    }
    return {
      contextLost: false,
      variation: Math.round(maximum - minimum),
      nonBlack,
      simulationActive: mount?.dataset.simulationActive,
      cameraMotionMode: mount?.dataset.cameraMotionMode,
      raftColliderCount: Number(mount?.dataset.raftColliderCount),
      raftTileCount: Number(mount?.dataset.raftTileCount),
      droppedSimulationSeconds: Number(mount?.dataset.droppedSimulationSeconds),
    };
  });
  assertFrameContent(finalState, 'm1-regression/final');
  if (finalState.simulationActive !== 'true') throw new Error('simulation did not resume after context restore');
  if (finalState.cameraMotionMode !== 'balanced') throw new Error('camera motion setting did not apply');
  if (finalState.raftColliderCount !== finalState.raftTileCount || finalState.raftTileCount <= 0) {
    throw new Error('dynamic raft colliders do not match tiles');
  }
  if (errors.length > 0) throw new Error(errors.join(' | '));
  console.log(JSON.stringify({ titleGate, contextMode: realContextLoss ? 'extension' : 'synthetic', finalState, errors }, null, 2));
  await context.close();
} finally {
  await runtime.browser.close();
  runtime.cleanup();
}
