import { mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';
import {
  assertCanvasHealthy,
  assertFrameContent,
  buildBrowserArgs,
  isCriticalBrowserMessage,
  resolveChromiumExecutable,
  summarizeRgbaPixels,
} from './capture-utils.mjs';

const nativePlatform = process.platform;
const isTermux = nativePlatform === 'android';
if (isTermux) {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE ??= 'ubuntu24.04-arm64';
}

const { chromium } = await import('@playwright/test');

const baseUrl = process.env.DRIFTWAKE_URL ?? 'http://127.0.0.1:4173';
const captureOnly = process.env.CAPTURE_ONLY ?? 'all';
const forceBlankFrame = process.env.DRIFTWAKE_FORCE_BLANK_FRAME === '1';
const headless = process.env.PLAYWRIGHT_HEADFUL !== '1';
const desktopWidth = Number(process.env.CAPTURE_WIDTH ?? 1440);
const desktopHeight = Number(process.env.CAPTURE_HEIGHT ?? 900);
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
const outputDir = new URL('../artifacts/screenshots/', import.meta.url);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  ...(chromiumPath ? { executablePath: chromiumPath } : {}),
  headless,
  args: buildBrowserArgs({ forceSwiftShader }),
});

const errors = [];
const diagnostics = [];

function monitorPage(page, label) {
  page.on('console', (message) => {
    const text = message.text();
    const type = message.type();
    if (isCriticalBrowserMessage(type, text)) {
      const line = `${label} ${type}: ${text}`;
      errors.push(line);
      console.error(line);
      return;
    }
    if (type === 'warning') console.warn(`${label} warning: ${text}`);
  });
  page.on('pageerror', (error) => {
    const line = `${label} page: ${error.message}`;
    errors.push(line);
    console.error(line);
  });
}

function summarizeCapturedFrame(screenshot, gateLabel) {
  const image = PNG.sync.read(screenshot);
  if (forceBlankFrame) {
    for (let offset = 0; offset < image.data.length; offset += 4) {
      image.data[offset] = 0;
      image.data[offset + 1] = 0;
      image.data[offset + 2] = 0;
      image.data[offset + 3] = 255;
    }
  }
  const frame = summarizeRgbaPixels(image.data, image.width, image.height);
  assertFrameContent(frame, gateLabel);
  return frame;
}

async function inspectCanvas(page, label, checkpoint) {
  const state = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      return { found: false, width: 0, height: 0, contextLost: true, renderer: null, vendor: null };
    }
    const gl = canvas.getContext('webgl2');
    const contextLost = !gl || gl.isContextLost();
    const debug = !contextLost ? gl.getExtension('WEBGL_debug_renderer_info') : null;
    return {
      found: true,
      width: canvas.width,
      height: canvas.height,
      contextLost,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
    };
  });
  const gateLabel = `${label}/${checkpoint}`;
  assertCanvasHealthy(state, gateLabel);
  const screenshot = await page.locator('canvas').screenshot();
  state.frame = summarizeCapturedFrame(screenshot, gateLabel);
  diagnostics.push({ label, checkpoint, ...state });
  console.log(`${label} canvas ${checkpoint}: ${JSON.stringify(state)}`);
  return state;
}

async function inspectTitlePage(page, checkpoint) {
  const state = await page.evaluate(() => ({
    canvasFound: document.querySelector('canvas') !== null,
    runtimeResources: performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /\/assets\/DriftwakeGame-[^/]+\.js(?:\?|$)/.test(name)),
  }));
  if (state.canvasFound) throw new Error(`title/${checkpoint}: world canvas loaded before player intent`);
  if (state.runtimeResources.length > 0) {
    throw new Error(`title/${checkpoint}: world runtime loaded before player intent`);
  }
  const screenshot = await page.screenshot();
  state.kind = 'page';
  state.frame = summarizeCapturedFrame(screenshot, `title/${checkpoint}`);
  diagnostics.push({ label: 'title', checkpoint, ...state });
  console.log(`title page ${checkpoint}: ${JSON.stringify(state)}`);
  return state;
}

async function openDesktopPage(label, { environmentOffset } = {}) {
  const context = await browser.newContext({
    viewport: { width: desktopWidth, height: desktopHeight },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  monitorPage(page, label);
  const targetUrl = new URL(baseUrl);
  if (environmentOffset !== undefined) targetUrl.searchParams.set('environmentOffset', String(environmentOffset));
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
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

async function enterGame(page) {
  await page.getByRole('button', { name: '开始漂流' }).click();
  await page.getByRole('button', { name: '进入海面' }).waitFor({ timeout: 45_000 });
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
}

async function captureTitle() {
  const { context, page } = await openDesktopPage('title');
  const buttonStyle = await page.locator('.primary-command').evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    disabled: element.disabled,
  }));
  console.log(`Title command: ${JSON.stringify(buttonStyle)}`);
  await inspectTitlePage(page, 'before-capture');
  await page.screenshot({ path: new URL('title-desktop.png', outputDir).pathname });
  await inspectTitlePage(page, 'after-capture');
  await context.close();
}

async function captureGame() {
  const { context, page } = await openDesktopPage('game');
  await enterGame(page);
  await page.waitForTimeout(1300);
  await inspectCanvas(page, 'game', 'before-capture');
  await page.screenshot({ path: new URL('game-desktop.png', outputDir).pathname });
  await inspectCanvas(page, 'game', 'after-capture');
  await context.close();
}

async function captureWeather() {
  const { context, page } = await openDesktopPage('weather', { environmentOffset: 315 });
  await enterGame(page);
  await page.waitForFunction(() => {
    const mount = document.querySelector('.game-mount');
    return mount?.dataset.weather === 'storm'
      && Number.parseFloat(mount.dataset.daylight ?? '1') < 0.1
      && Number.parseFloat(mount.dataset.environmentRisk ?? '0') > 0.9;
  }, undefined, { timeout: 10_000, polling: 100 });
  const layoutHealthy = await page.evaluate(() => {
    const environment = document.querySelector('.environment-readout')?.getBoundingClientRect();
    const resources = document.querySelector('.resource-strip')?.getBoundingClientRect();
    const actions = document.querySelector('.hud-actions')?.getBoundingClientRect();
    return Boolean(environment && resources && actions)
      && resources.right < environment.left
      && environment.right < actions.left
      && document.body.scrollWidth <= document.documentElement.clientWidth;
  });
  if (!layoutHealthy) throw new Error('weather: environment HUD overlaps adjacent controls or overflows');
  await inspectCanvas(page, 'weather', 'storm-night-before-capture');
  await page.screenshot({ path: new URL('storm-night-desktop.png', outputDir).pathname });
  await inspectCanvas(page, 'weather', 'storm-night-after-capture');
  await context.close();
}

async function captureHook() {
  const { context, page } = await openDesktopPage('hook');
  await enterGame(page);
  await page.mouse.move(Math.round(desktopWidth * 0.53), Math.round(desktopHeight * 0.48));
  await page.mouse.down();
  try {
    await page.waitForTimeout(650);
    const chargeVisible = await page.locator('.hook-charge').evaluate((element) => (
      element.classList.contains('is-active') && Number.parseFloat(getComputedStyle(element).opacity) > 0
    ));
    if (!chargeVisible) throw new Error('hook: charge feedback did not become visible');
    await inspectCanvas(page, 'hook', 'charging-before-capture');
    await page.screenshot({ path: new URL('hook-desktop.png', outputDir).pathname });
    await inspectCanvas(page, 'hook', 'charging-after-capture');
  } finally {
    await page.mouse.up();
  }
  await page.waitForTimeout(450);
  const chargeHidden = await page.locator('.hook-charge').evaluate((element) => (
    !element.classList.contains('is-active') && Number.parseFloat(getComputedStyle(element).opacity) < 0.1
  ));
  if (!chargeHidden) throw new Error('hook: charge feedback remained visible after release');
  await context.close();
}

async function captureLocomotion() {
  const { context, page } = await openDesktopPage('locomotion');
  await enterGame(page);

  await page.keyboard.down('KeyS');
  try {
    await page.waitForFunction(
      () => document.querySelector('.game-mount')?.dataset.playerMode === 'swimming',
      undefined,
      { timeout: 12_000, polling: 100 },
    );
  } finally {
    await page.keyboard.up('KeyS');
  }

  await page.keyboard.down('KeyC');
  try {
    await page.waitForFunction(
      () => Number.parseFloat(getComputedStyle(document.querySelector('.game-mount')).getPropertyValue('--underwater-mix')) >= 0.3,
      undefined,
      { timeout: 8_000, polling: 100 },
    );
    await inspectCanvas(page, 'locomotion', 'underwater-before-capture');
    await page.screenshot({ path: new URL('underwater-desktop.png', outputDir).pathname });
    await inspectCanvas(page, 'locomotion', 'underwater-after-capture');
  } finally {
    await page.keyboard.up('KeyC');
  }

  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  try {
    await page.waitForFunction(
      () => document.querySelector('.game-mount')?.dataset.playerMode === 'raft',
      undefined,
      { timeout: 12_000, polling: 100 },
    );
  } finally {
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyW');
  }

  const hintHidden = await page.locator('.locomotion-hint').getAttribute('aria-hidden');
  if (hintHidden !== 'true') throw new Error('locomotion: swimming hint remained exposed after climbing');
  await context.close();
}

async function captureSettings() {
  const { context, page } = await openDesktopPage('settings');
  await enterGame(page);
  await page.keyboard.press('Escape');
  if (await page.evaluate(() => document.pointerLockElement !== null)) {
    await page.evaluate(() => document.exitPointerLock());
  }
  await page.waitForFunction(() => document.pointerLockElement === null, undefined, { timeout: 5_000 });
  await page.getByRole('button', { name: '继续漂流' }).waitFor({ timeout: 5_000 });
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByRole('dialog', { name: '设置' }).waitFor({ timeout: 5_000 });
  await page.setViewportSize({ width: 1280, height: 577 });
  const layout = await page.evaluate(() => {
    const panel = document.querySelector('.settings-panel');
    const header = document.querySelector('.settings-panel__header');
    const sliders = [...document.querySelectorAll('.setting-slider')];
    const panelRect = panel?.getBoundingClientRect();
    if (!panel || !header || !panelRect) return null;
    const sliderWidths = sliders.map((slider) => slider.querySelector('input')?.getBoundingClientRect().width ?? 0);
    const maxScroll = panel.scrollHeight - panel.clientHeight;
    panel.scrollTop = panel.scrollHeight;
    const qualityRect = document.querySelector('.segmented-control')?.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const bottomReachable = Boolean(qualityRect)
      && qualityRect.bottom <= panelRect.bottom
      && qualityRect.top >= headerRect.bottom;
    panel.scrollTop = 0;
    return {
      sliderCount: sliders.length,
      sliderWidths,
      maxScroll,
      horizontalOverflow: panel.scrollWidth - panel.clientWidth,
      bodyHorizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panelInsideViewport: panelRect.top >= 0 && panelRect.bottom <= window.innerHeight,
      stickyHeader: getComputedStyle(header).position === 'sticky',
      bottomReachable,
    };
  });
  if (
    !layout
    || layout.sliderCount !== 5
    || layout.sliderWidths.some((width) => width < 240)
    || layout.maxScroll <= 0
    || layout.horizontalOverflow > 0
    || layout.bodyHorizontalOverflow > 0
    || !layout.panelInsideViewport
    || !layout.stickyHeader
    || !layout.bottomReachable
  ) {
    throw new Error(`settings: invalid responsive layout ${JSON.stringify(layout)}`);
  }
  await inspectCanvas(page, 'settings', 'before-capture');
  await page.screenshot({ path: new URL('settings-desktop.png', outputDir).pathname });
  await inspectCanvas(page, 'settings', 'after-capture');
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
  await page.locator('.capability-screen').waitFor({ timeout: 5_000 });
  const layoutHealthy = await page.evaluate(() => {
    const brand = document.querySelector('.capability-screen__brand')?.getBoundingClientRect();
    const message = document.querySelector('.capability-screen__message')?.getBoundingClientRect();
    return Boolean(brand && message)
      && brand.left >= 0
      && brand.top >= 0
      && brand.right <= window.innerWidth
      && message.left >= 0
      && message.right <= window.innerWidth
      && message.top >= brand.bottom
      && message.bottom <= window.innerHeight
      && document.documentElement.scrollWidth <= document.documentElement.clientWidth
      && document.documentElement.scrollHeight <= document.documentElement.clientHeight;
  });
  if (!layoutHealthy) throw new Error('mobile: capability layout is clipped, overlapping, or overflowing');
  const screenshot = await page.screenshot({ path: new URL('capability-mobile.png', outputDir).pathname });
  const image = PNG.sync.read(screenshot);
  const frame = summarizeRgbaPixels(image.data, image.width, image.height);
  assertFrameContent(frame, 'mobile/capability-page');
  console.log(`mobile page: ${JSON.stringify({ width: image.width, height: image.height, frame })}`);
  await context.close();
}

try {
  if (captureOnly === 'all' || captureOnly === 'title') await captureTitle();
  if (captureOnly === 'all' || captureOnly === 'game') await captureGame();
  if (captureOnly === 'all' || captureOnly === 'weather') await captureWeather();
  if (captureOnly === 'all' || captureOnly === 'hook') await captureHook();
  if (captureOnly === 'all' || captureOnly === 'locomotion') await captureLocomotion();
  if (captureOnly === 'all' || captureOnly === 'settings') await captureSettings();
  if (captureOnly === 'all' || captureOnly === 'mobile') await captureMobile();
} finally {
  await browser.close();
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Render diagnostics: ${JSON.stringify(diagnostics)}`);
  console.log(`Captured Driftwake at ${baseUrl}${forceSwiftShader ? ' with forced SwiftShader' : ''}`);
}
