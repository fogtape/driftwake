import { accessSync, constants } from 'node:fs';

export function buildBrowserArgs({ forceSwiftShader = false } = {}) {
  const args = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu-sandbox',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ];
  if (forceSwiftShader) {
    args.push(
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader-webgl',
    );
  }
  return args;
}

export function resolveStabilityProfile({
  quality = 'low',
  viewportWidth,
  viewportHeight,
  minimumFps,
  minimumRenderScale = 1,
} = {}) {
  if (quality !== 'low' && quality !== 'high') {
    throw new Error('stability quality must be low or high');
  }
  const resolvedViewportWidth = viewportWidth ?? (quality === 'high' ? 1920 : 1280);
  const resolvedViewportHeight = viewportHeight ?? (quality === 'high' ? 1080 : 720);
  if (!Number.isInteger(resolvedViewportWidth) || resolvedViewportWidth <= 0) {
    throw new Error('stability viewport width must be a positive integer');
  }
  if (!Number.isInteger(resolvedViewportHeight) || resolvedViewportHeight <= 0) {
    throw new Error('stability viewport height must be a positive integer');
  }
  const resolvedMinimumFps = minimumFps ?? (quality === 'high' ? 60 : 30);
  if (!Number.isFinite(resolvedMinimumFps) || resolvedMinimumFps <= 0) {
    throw new Error('stability minimum FPS must be finite and positive');
  }
  if (!Number.isFinite(minimumRenderScale) || minimumRenderScale <= 0 || minimumRenderScale > 1) {
    throw new Error('stability minimum render scale must be greater than 0 and at most 1');
  }
  return {
    quality,
    viewportWidth: resolvedViewportWidth,
    viewportHeight: resolvedViewportHeight,
    minimumFps: resolvedMinimumFps,
    minimumRenderScale,
  };
}

export function buildStabilitySchedule({
  durationSeconds,
  sampleSeconds,
  contentSeconds,
  minimumPeriodicContentSeconds = 10,
}) {
  const inputs = [durationSeconds, sampleSeconds, contentSeconds, minimumPeriodicContentSeconds];
  if (inputs.some((value) => !Number.isFinite(value)) || durationSeconds <= 0 || sampleSeconds <= 0 || contentSeconds <= 0) {
    throw new Error('stability schedule inputs must be finite and positive');
  }
  const sampleIntervals = Math.floor(durationSeconds / sampleSeconds);
  if (sampleIntervals > 100_000) throw new Error('stability schedule contains too many samples');

  const entries = new Map();
  const addEntry = (atSeconds, inspectContent) => {
    const bounded = Math.min(durationSeconds, Math.max(0, atSeconds));
    const normalized = Number(bounded.toFixed(6));
    entries.set(normalized, Boolean(entries.get(normalized)) || inspectContent);
  };

  for (let index = 0; index <= sampleIntervals; index += 1) {
    addEntry(index * sampleSeconds, false);
  }
  addEntry(0, true);
  addEntry(durationSeconds, true);

  if (contentSeconds >= minimumPeriodicContentSeconds) {
    const contentIntervals = Math.floor(durationSeconds / contentSeconds);
    for (let index = 1; index < contentIntervals; index += 1) {
      addEntry(index * contentSeconds, true);
    }
  }

  return [...entries.entries()]
    .sort(([left], [right]) => left - right)
    .map(([atSeconds, inspectContent]) => ({ atSeconds, inspectContent }));
}

export function resolveChromiumExecutable({
  configuredPath,
  candidates = [],
  isExecutable = defaultIsExecutable,
} = {}) {
  if (configuredPath) {
    if (!isExecutable(configuredPath)) {
      throw new Error(`CHROMIUM_PATH is not executable: ${configuredPath}`);
    }
    return configuredPath;
  }
  return candidates.find((candidate) => isExecutable(candidate));
}

export function assertCanvasHealthy(state, label) {
  if (!state?.found) throw new Error(`${label}: canvas was not found`);
  if (state.width <= 0 || state.height <= 0) throw new Error(`${label}: canvas is zero-sized`);
  if (state.contextLost) throw new Error(`${label}: WebGL context is lost`);
  return state;
}

export function summarizeRgbaPixels(pixels, width, height) {
  const safeWidth = Number.isInteger(width) && width > 0 ? width : 0;
  const safeHeight = Number.isInteger(height) && height > 0 ? height : 0;
  const stepX = Math.max(1, Math.floor(safeWidth / 48));
  const stepY = Math.max(1, Math.floor(safeHeight / 32));
  const colors = new Set();
  let sampleCount = 0;
  let opaqueCount = 0;
  let luminanceMin = 255;
  let luminanceMax = 0;
  let luminanceSum = 0;
  let luminanceSquareSum = 0;

  for (let y = Math.floor(stepY / 2); y < safeHeight; y += stepY) {
    for (let x = Math.floor(stepX / 2); x < safeWidth; x += stepX) {
      const offset = (y * safeWidth + x) * 4;
      if (offset + 3 >= pixels.length) continue;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const alpha = pixels[offset + 3];
      const luminance = (red * 54 + green * 183 + blue * 19) / 256;
      sampleCount += 1;
      if (alpha > 8) opaqueCount += 1;
      luminanceMin = Math.min(luminanceMin, luminance);
      luminanceMax = Math.max(luminanceMax, luminance);
      luminanceSum += luminance;
      luminanceSquareSum += luminance * luminance;
      colors.add(((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4));
    }
  }

  const mean = sampleCount ? luminanceSum / sampleCount : 0;
  return {
    sampleCount,
    opaqueRatio: sampleCount ? opaqueCount / sampleCount : 0,
    luminanceRange: sampleCount ? luminanceMax - luminanceMin : 0,
    luminanceStdDev: sampleCount
      ? Math.sqrt(Math.max(0, luminanceSquareSum / sampleCount - mean * mean))
      : 0,
    colorBins: colors.size,
  };
}

export function assertFrameContent(metrics, label) {
  if (!metrics || metrics.sampleCount < 128) throw new Error(`${label}: too few captured-canvas samples`);
  if (metrics.opaqueRatio < 0.75) throw new Error(`${label}: captured canvas is mostly transparent`);
  if (metrics.luminanceRange < 12) throw new Error(`${label}: captured-canvas luminance range is too small`);
  if (metrics.luminanceStdDev < 3) throw new Error(`${label}: captured-canvas luminance variance is too small`);
  if (metrics.colorBins < 6) throw new Error(`${label}: captured canvas has insufficient color variation`);
  return metrics;
}

export function summarizeStabilitySamples(samples, { requestedSeconds, errors }) {
  const heaps = samples
    .map((sample) => sample.usedHeap)
    .filter((value) => Number.isFinite(value));
  const fpsValues = samples
    .map((sample) => Number(sample.fps))
    .filter((value) => Number.isFinite(value) && value > 0);
  const weatherKinds = [...new Set(samples
    .map((sample) => sample.weather)
    .filter((value) => typeof value === 'string' && value.length > 0))];
  const qualityKinds = [...new Set(samples
    .map((sample) => sample.quality)
    .filter((value) => typeof value === 'string' && value.length > 0))];
  const daylightValues = samples
    .map((sample) => Number(sample.daylight))
    .filter((value) => Number.isFinite(value));
  const environmentRiskValues = samples
    .map((sample) => Number(sample.environmentRisk))
    .filter((value) => Number.isFinite(value));
  const finiteMetric = (key) => samples
    .map((sample) => sample[key])
    .filter((value) => Number.isFinite(value));
  const renderScales = finiteMetric('renderScale');
  const pixelRatios = finiteMetric('pixelRatio');
  const drawCalls = finiteMetric('drawCalls');
  const triangles = finiteMetric('triangles');
  const geometries = finiteMetric('geometries');
  const textures = finiteMetric('textures');
  const debrisCounts = finiteMetric('debrisCount');
  const observedSeconds = Number(samples.at(-1)?.elapsedSeconds);

  return {
    requestedSeconds,
    observedSeconds: Number.isFinite(observedSeconds) ? observedSeconds : 0,
    sampleCount: samples.length,
    contentSampleCount: samples.filter((sample) => sample.frame).length,
    pointerLockedThroughout: samples.length > 0 && samples.every((sample) => sample.pointerLocked),
    simulationActiveThroughout: samples.length > 0 && samples.every((sample) => sample.simulationActive),
    contextLost: samples.some((sample) => sample.contextLost),
    heapStart: heaps[0] ?? null,
    heapEnd: heaps.at(-1) ?? null,
    heapMin: heaps.length ? Math.min(...heaps) : null,
    heapMax: heaps.length ? Math.max(...heaps) : null,
    heapGrowth: heaps.length ? heaps.at(-1) - heaps[0] : null,
    fpsMin: fpsValues.length ? Math.min(...fpsValues) : null,
    fpsMax: fpsValues.length ? Math.max(...fpsValues) : null,
    weatherKinds,
    qualityKinds,
    daylightMin: daylightValues.length ? Math.min(...daylightValues) : null,
    daylightMax: daylightValues.length ? Math.max(...daylightValues) : null,
    environmentRiskMax: environmentRiskValues.length ? Math.max(...environmentRiskValues) : null,
    renderScaleMin: renderScales.length ? Math.min(...renderScales) : null,
    renderScaleMax: renderScales.length ? Math.max(...renderScales) : null,
    pixelRatioMin: pixelRatios.length ? Math.min(...pixelRatios) : null,
    pixelRatioMax: pixelRatios.length ? Math.max(...pixelRatios) : null,
    drawCallsMax: drawCalls.length ? Math.max(...drawCalls) : null,
    trianglesMax: triangles.length ? Math.max(...triangles) : null,
    geometriesMax: geometries.length ? Math.max(...geometries) : null,
    texturesMax: textures.length ? Math.max(...textures) : null,
    debrisCountMin: debrisCounts.length ? Math.min(...debrisCounts) : null,
    debrisCountMax: debrisCounts.length ? Math.max(...debrisCounts) : null,
    errors: [...errors],
  };
}

export function isSoftwareRenderer(renderer) {
  return typeof renderer === 'string'
    && /swiftshader|llvmpipe|softpipe|software rasterizer|basic render driver/i.test(renderer);
}

export function validateStabilitySummary(summary, policy) {
  const failures = [];
  const expectedSamples = Math.floor(summary.requestedSeconds / policy.sampleSeconds) + 1;
  const durationCoverage = summary.requestedSeconds > 0
    ? summary.observedSeconds / summary.requestedSeconds
    : 0;
  const sampleCoverage = expectedSamples > 0 ? summary.sampleCount / expectedSamples : 0;

  if (durationCoverage < policy.minimumDurationRatio) {
    failures.push(`duration coverage ${durationCoverage.toFixed(3)} is below ${policy.minimumDurationRatio}`);
  }
  if (sampleCoverage < policy.minimumSampleCoverage) {
    failures.push(`sample coverage ${sampleCoverage.toFixed(3)} is below ${policy.minimumSampleCoverage}`);
  }
  if (summary.contentSampleCount < policy.minimumContentSamples) {
    failures.push(`content samples ${summary.contentSampleCount} are below ${policy.minimumContentSamples}`);
  }
  if (!summary.pointerLockedThroughout) failures.push('pointer lock was not held throughout the run');
  if (!summary.simulationActiveThroughout) failures.push('gameplay simulation was not active throughout the run');
  if (summary.contextLost) failures.push('WebGL context was lost');
  if (summary.errors?.length) failures.push(`browser errors: ${summary.errors.length}`);

  if (typeof policy.quality === 'string' && policy.quality.length > 0) {
    const qualityKinds = summary.qualityKinds ?? [];
    if (qualityKinds.length !== 1 || qualityKinds[0] !== policy.quality) {
      failures.push(`quality evidence ${qualityKinds.join(',') || 'unavailable'} does not match ${policy.quality}`);
    }
  }
  if (Number.isFinite(policy.expectedDebrisCount)) {
    if (!Number.isFinite(summary.debrisCountMin) || !Number.isFinite(summary.debrisCountMax)) {
      failures.push('debris-count evidence is unavailable');
    } else if (
      summary.debrisCountMin !== policy.expectedDebrisCount
      || summary.debrisCountMax !== policy.expectedDebrisCount
    ) {
      failures.push(
        `debris count range ${summary.debrisCountMin}-${summary.debrisCountMax} does not match ${policy.expectedDebrisCount}`,
      );
    }
  }

  if (
    Number.isFinite(policy.minimumWeatherKinds)
    && policy.minimumWeatherKinds > 0
    && (summary.weatherKinds?.length ?? 0) < policy.minimumWeatherKinds
  ) {
    failures.push(`weather kinds ${summary.weatherKinds?.length ?? 0} are below ${policy.minimumWeatherKinds}`);
  }
  if (Number.isFinite(policy.minimumDaylightRange) && policy.minimumDaylightRange > 0) {
    const daylightRange = Number(summary.daylightMax) - Number(summary.daylightMin);
    if (!Number.isFinite(summary.daylightMin) || !Number.isFinite(summary.daylightMax)) {
      failures.push('daylight range evidence is unavailable');
    } else if (daylightRange < policy.minimumDaylightRange) {
      failures.push(`daylight range ${daylightRange.toFixed(3)} is below ${policy.minimumDaylightRange}`);
    }
  }

  if (!Number.isFinite(summary.heapGrowth)) {
    failures.push('heap evidence is unavailable');
  } else if (summary.heapGrowth > policy.maximumHeapGrowthBytes) {
    failures.push(`heap growth ${summary.heapGrowth} exceeds ${policy.maximumHeapGrowthBytes} bytes`);
  }

  if (!Number.isFinite(summary.fpsMin)) {
    failures.push('FPS evidence is unavailable');
  } else if (summary.fpsMin < policy.minimumFps) {
    failures.push(`minimum FPS ${summary.fpsMin} is below ${policy.minimumFps}`);
  }
  if (Number.isFinite(policy.minimumRenderScale) && policy.minimumRenderScale > 0) {
    if (!Number.isFinite(summary.renderScaleMin)) {
      failures.push('render scale evidence is unavailable');
    } else if (summary.renderScaleMin + 0.0005 < policy.minimumRenderScale) {
      failures.push(`minimum render scale ${summary.renderScaleMin} is below ${policy.minimumRenderScale}`);
    }
  }
  if (policy.allowSoftwareRenderer !== true) {
    if (typeof summary.renderer !== 'string' || summary.renderer.length === 0) {
      failures.push('renderer evidence is unavailable');
    } else if (isSoftwareRenderer(summary.renderer)) {
      failures.push('software renderer is not allowed for this stability profile');
    }
  }
  return failures;
}

export function isCriticalBrowserMessage(type, text) {
  return type === 'error' || /context[\s_-]*lost|CONTEXT_LOST_WEBGL/i.test(text);
}

function defaultIsExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
