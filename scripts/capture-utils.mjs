export function buildStabilitySchedule({ durationSeconds, sampleSeconds, contentSeconds }) {
  if ([durationSeconds, sampleSeconds, contentSeconds].some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('stability schedule inputs must be finite and positive');
  }
  const entries = new Map([[0, true], [durationSeconds, true]]);
  for (let at = sampleSeconds; at < durationSeconds; at += sampleSeconds) entries.set(at, Boolean(entries.get(at)));
  for (let at = contentSeconds; at < durationSeconds; at += contentSeconds) entries.set(at, true);
  return [...entries.entries()]
    .sort(([left], [right]) => left - right)
    .map(([atSeconds, inspectContent]) => ({ atSeconds, inspectContent }));
}

export function resolveStabilityProfile({
  quality = 'low',
  viewportWidth,
  viewportHeight,
  minimumFps,
  minimumRenderScale = 1,
} = {}) {
  if (quality !== 'low' && quality !== 'high') throw new Error('stability quality must be low or high');
  const width = viewportWidth ?? (quality === 'high' ? 1920 : 1280);
  const height = viewportHeight ?? (quality === 'high' ? 1080 : 720);
  const fps = minimumFps ?? (quality === 'high' ? 60 : 30);
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error('stability viewport must use positive integers');
  }
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('stability minimum FPS must be positive');
  if (!Number.isFinite(minimumRenderScale) || minimumRenderScale <= 0 || minimumRenderScale > 1) {
    throw new Error('stability minimum render scale must be within (0, 1]');
  }
  return { quality, viewportWidth: width, viewportHeight: height, minimumFps: fps, minimumRenderScale };
}

export function summarizeStabilitySamples(samples, { requestedSeconds, errors = [] } = {}) {
  const finite = (key) => samples.map((sample) => Number(sample[key])).filter(Number.isFinite);
  const fps = finite('fps').filter((value) => value > 0).sort((a, b) => a - b);
  const heaps = finite('usedHeap');
  const renderScales = finite('renderScale');
  const pixelRatios = finite('pixelRatio');
  const drawCalls = finite('drawCalls');
  const triangles = finite('triangles');
  const geometries = finite('geometries');
  const textures = finite('textures');
  const simulationTicks = finite('simulationTickCount');
  const dropped = finite('droppedSimulationSeconds');
  const frameP95 = finite('frameP95Ms');
  const colliders = finite('raftColliderCount');
  const tiles = finite('raftTileCount');
  const debrisCounts = finite('debrisCount');
  const heapSlopeBytesPerMinute = regressionSlope(
    samples
      .map((sample) => ({ x: Number(sample.elapsedSeconds) / 60, y: Number(sample.usedHeap) }))
      .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
  );
  const warmupIndex = Math.min(Math.max(1, Math.floor(heaps.length * 0.2)), Math.max(1, heaps.length - 1));
  const warmHeaps = heaps.slice(warmupIndex);
  const windowSize = Math.max(1, Math.min(3, Math.floor(warmHeaps.length / 2)));
  const retainedHeapGrowth = warmHeaps.length >= 2
    ? median(warmHeaps.slice(-windowSize)) - median(warmHeaps.slice(0, windowSize))
    : null;

  return {
    requestedSeconds,
    observedSeconds: Number(samples.at(-1)?.elapsedSeconds) || 0,
    sampleCount: samples.length,
    contentSampleCount: samples.filter((sample) => sample.frameContent).length,
    pointerLockedThroughout: samples.length > 0 && samples.every((sample) => sample.pointerLocked),
    simulationActiveThroughout: samples.length > 0 && samples.every((sample) => sample.simulationActive),
    contextLost: samples.some((sample) => sample.contextLost),
    fpsP10: fps.length ? percentile(fps, 0.1) : null,
    fpsMedian: fps.length ? percentile(fps, 0.5) : null,
    frameP95Max: frameP95.length ? Math.max(...frameP95) : null,
    renderScaleMin: renderScales.length ? Math.min(...renderScales) : null,
    renderScaleMax: renderScales.length ? Math.max(...renderScales) : null,
    pixelRatioMin: pixelRatios.length ? Math.min(...pixelRatios) : null,
    pixelRatioMax: pixelRatios.length ? Math.max(...pixelRatios) : null,
    drawCallsMin: drawCalls.length ? Math.min(...drawCalls) : null,
    drawCallsMax: drawCalls.length ? Math.max(...drawCalls) : null,
    trianglesMax: triangles.length ? Math.max(...triangles) : null,
    geometriesMin: geometries.length ? Math.min(...geometries) : null,
    geometriesMax: geometries.length ? Math.max(...geometries) : null,
    texturesMin: textures.length ? Math.min(...textures) : null,
    texturesMax: textures.length ? Math.max(...textures) : null,
    simulationTickCountStart: simulationTicks[0] ?? null,
    simulationTickCountEnd: simulationTicks.at(-1) ?? null,
    droppedSimulationSecondsMax: dropped.length ? Math.max(...dropped) : null,
    heapStart: heaps[0] ?? null,
    heapEnd: heaps.at(-1) ?? null,
    heapMax: heaps.length ? Math.max(...heaps) : null,
    retainedHeapGrowth,
    heapSlopeBytesPerMinute,
    raftColliderCountMin: colliders.length ? Math.min(...colliders) : null,
    raftColliderCountMax: colliders.length ? Math.max(...colliders) : null,
    raftTileCountMin: tiles.length ? Math.min(...tiles) : null,
    raftTileCountMax: tiles.length ? Math.max(...tiles) : null,
    debrisCountMin: debrisCounts.length ? Math.min(...debrisCounts) : null,
    debrisCountMax: debrisCounts.length ? Math.max(...debrisCounts) : null,
    qualityKinds: [...new Set(samples.map((sample) => sample.quality).filter(Boolean))],
    playerSurfaces: [...new Set(samples.map((sample) => sample.playerSurface).filter(Boolean))],
    observedAirborne: samples.some((sample) => sample.playerAirborne),
    frameDrivers: [...new Set(samples.map((sample) => sample.frameDriver).filter(Boolean))],
    errors: [...errors],
  };
}

export function validateStabilitySummary(summary, policy) {
  const failures = [];
  const expectedSamples = Math.floor(summary.requestedSeconds / policy.sampleSeconds) + 1;
  const durationCoverage = summary.requestedSeconds > 0 ? summary.observedSeconds / summary.requestedSeconds : 0;
  const sampleCoverage = expectedSamples > 0 ? summary.sampleCount / expectedSamples : 0;
  if (durationCoverage < policy.minimumDurationRatio) failures.push('duration coverage is incomplete');
  if (sampleCoverage < policy.minimumSampleCoverage) failures.push('sample coverage is incomplete');
  if (summary.contentSampleCount < policy.minimumContentSamples) failures.push('frame-content coverage is incomplete');
  if (!summary.pointerLockedThroughout) failures.push('pointer lock was not held throughout');
  if (!summary.simulationActiveThroughout) failures.push('simulation was not active throughout');
  if (summary.contextLost) failures.push('WebGL context was lost');
  if (summary.errors.length > 0) failures.push(`browser errors: ${summary.errors.length}`);
  if (!Number.isFinite(summary.fpsP10) || summary.fpsP10 < policy.minimumFps) failures.push('p10 FPS is below policy');
  if (!Number.isFinite(summary.renderScaleMin) || summary.renderScaleMin + 0.0005 < policy.minimumRenderScale) {
    failures.push('render scale is below policy');
  }
  if (!Number.isFinite(summary.retainedHeapGrowth)) failures.push('retained heap evidence is unavailable');
  else if (summary.retainedHeapGrowth > policy.maximumRetainedHeapGrowthBytes) failures.push('retained heap growth exceeds policy');
  if (!Number.isFinite(summary.heapSlopeBytesPerMinute)) failures.push('heap slope evidence is unavailable');
  else if (summary.heapSlopeBytesPerMinute > policy.maximumHeapSlopeBytesPerMinute) failures.push('heap slope exceeds policy');
  if (
    !Number.isFinite(summary.raftColliderCountMin)
    || summary.raftColliderCountMin !== summary.raftTileCountMin
    || summary.raftColliderCountMax !== summary.raftTileCountMax
  ) failures.push('raft collider count diverged from dynamic tile count');
  if (
    policy.quality
    && (summary.qualityKinds.length !== 1 || summary.qualityKinds[0] !== policy.quality)
  ) failures.push('quality preset changed during the run');
  if (
    Number.isFinite(policy.expectedDebrisCount)
    && (summary.debrisCountMin !== policy.expectedDebrisCount || summary.debrisCountMax !== policy.expectedDebrisCount)
  ) failures.push('debris budget changed during the run');
  if (
    Number.isFinite(policy.maximumDroppedSimulationSeconds)
    && (!Number.isFinite(summary.droppedSimulationSecondsMax)
      || summary.droppedSimulationSecondsMax > policy.maximumDroppedSimulationSeconds)
  ) failures.push('dropped simulation time exceeds policy');
  if (!policy.allowSoftwareRenderer) {
    if (!summary.renderer) failures.push('renderer evidence is unavailable');
    else if (isSoftwareRenderer(summary.renderer)) failures.push('software renderer is not allowed');
  }
  if (
    policy.requireNativeFrameDriver
    && (summary.frameDrivers.length !== 1 || summary.frameDrivers[0] !== 'native')
  ) failures.push('native animation frame driver was not held throughout');
  return failures;
}

export function isSoftwareRenderer(renderer) {
  return typeof renderer === 'string'
    && /swiftshader|llvmpipe|softpipe|software rasterizer|basic render driver/i.test(renderer);
}

export function assertFrameContent(frame, label) {
  if (!frame || frame.contextLost) throw new Error(`${label}: WebGL context is unavailable`);
  if (frame.variation < 4 || frame.nonBlack < 32) throw new Error(`${label}: canvas content is blank`);
}

export function assertEncodedFrameContent(frame, label) {
  if (!frame || frame.contextLost) throw new Error(`${label}: WebGL context is unavailable`);
  const minimumBytes = Math.max(8_192, Math.floor(Number(frame.width) * Number(frame.height) * 0.015));
  if (!Number.isFinite(frame.encodedBytes) || frame.encodedBytes < minimumBytes) {
    throw new Error(`${label}: composited canvas content is blank`);
  }
}

export function isCriticalBrowserMessage(type, value) {
  return type === 'error' || /context[\s_-]*lost|CONTEXT_LOST_WEBGL/i.test(value);
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function regressionSlope(points) {
  if (points.length < 2) return null;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.x - meanX) * (point.y - meanY);
    denominator += (point.x - meanX) ** 2;
  }
  return denominator > 0 ? numerator / denominator : null;
}
