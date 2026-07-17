import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';

const nativePlatform = process.platform;

export function preparePlaywrightPlatform() {
  const isAndroid = nativePlatform === 'android';
  if (isAndroid) {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE ??= 'ubuntu24.04-arm64';
  }
  return { isAndroid };
}

export async function launchDriftwakeChromium(chromium, {
  width = 1440,
  height = 900,
  chromiumPath = process.env.CHROMIUM_PATH,
} = {}) {
  const isAndroid = nativePlatform === 'android';
  const executablePath = resolveChromiumExecutable(chromiumPath, isAndroid);
  const autoVirtualDisplay = isAndroid && !process.env.DISPLAY && process.env.PLAYWRIGHT_HEADFUL !== '0';
  const virtualDisplay = autoVirtualDisplay ? await startVirtualDisplay(width, height) : null;
  const headless = virtualDisplay ? false : process.env.PLAYWRIGHT_HEADFUL !== '1';
  const forceSwiftShader = process.env.DRIFTWAKE_FORCE_SWIFTSHADER === '1';
  const headlessGles = headless && process.env.DRIFTWAKE_HEADLESS_GLES === '1';
  const useSwiftShader = forceSwiftShader || (headless && !headlessGles);
  const renderingArgs = useSwiftShader
    ? ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader-webgl']
    : ['--use-gl=angle', '--use-angle=gles'];

  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu-sandbox',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=CalculateNativeWinOcclusion',
      '--disable-gpu-vsync',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      ...renderingArgs,
    ],
  });

  const cleanup = () => {
    if (virtualDisplay?.exitCode === null) virtualDisplay.kill('SIGTERM');
  };
  process.once('exit', cleanup);
  return {
    browser,
    headless,
    rendererMode: useSwiftShader ? 'swiftshader' : 'gles',
    cleanup: () => {
      cleanup();
      process.off('exit', cleanup);
    },
  };
}

function resolveChromiumExecutable(configuredPath, isAndroid) {
  const prefix = process.env.PREFIX;
  const candidates = [
    configuredPath,
    ...(isAndroid && prefix ? [`${prefix}/bin/chromium-browser`, `${prefix}/bin/chromium`] : []),
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((candidate) => {
    try {
      accessSync(candidate, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

async function startVirtualDisplay(width, height) {
  const display = `:${100 + (process.pid % 400)}`;
  const server = spawn(
    'Xvfb',
    [display, '-screen', '0', `${Math.max(1440, width)}x${Math.max(900, height)}x24`, '-nolisten', 'tcp', '-ac'],
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
