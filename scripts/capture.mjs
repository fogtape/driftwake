import { mkdir } from 'node:fs/promises';

if (process.platform === 'android') {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE ??= 'ubuntu24.04-arm64';
}

const { chromium } = await import('@playwright/test');

const baseUrl = process.env.DRIFTWAKE_URL ?? 'http://127.0.0.1:4173';
const captureOnly = process.env.CAPTURE_ONLY ?? 'all';
const headless = process.env.PLAYWRIGHT_HEADFUL !== '1';
const desktopWidth = Number(process.env.CAPTURE_WIDTH ?? 1440);
const desktopHeight = Number(process.env.CAPTURE_HEIGHT ?? 900);
const chromiumPath = process.env.CHROMIUM_PATH ?? '/data/data/com.termux/files/usr/bin/chromium-browser';
const outputDir = new URL('../artifacts/screenshots/', import.meta.url);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromiumPath,
  headless,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu-sandbox',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader-webgl',
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

async function openDesktopPage(label) {
  const context = await browser.newContext({
    viewport: { width: desktopWidth, height: desktopHeight },
    deviceScaleFactor: 1,
  });
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
  await page.screenshot({ path: new URL('game-desktop.png', outputDir).pathname });
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
  if (captureOnly === 'all' || captureOnly === 'mobile') await captureMobile();
} finally {
  await browser.close();
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Captured Driftwake at ${baseUrl}`);
}
