import { describe, expect, it, vi } from 'vitest';
import {
  assertCanvasHealthy,
  assertFrameContent,
  buildBrowserArgs,
  buildStabilitySchedule,
  isCriticalBrowserMessage,
  resolveChromiumExecutable,
  summarizeRgbaPixels,
  summarizeStabilitySamples,
  validateStabilitySummary,
} from './capture-utils.mjs';

describe('buildBrowserArgs', () => {
  it('keeps the default run on the browser-selected GPU backend', () => {
    const args = buildBrowserArgs({ forceSwiftShader: false });

    expect(args).toContain('--enable-webgl');
    expect(args).not.toContain('--enable-unsafe-swiftshader');
    expect(args).not.toContain('--use-angle=swiftshader-webgl');
  });

  it('enables SwiftShader only when the caller explicitly requests it', () => {
    const args = buildBrowserArgs({ forceSwiftShader: true });

    expect(args).toContain('--enable-unsafe-swiftshader');
    expect(args).toContain('--use-gl=angle');
    expect(args).toContain('--use-angle=swiftshader-webgl');
  });
});

describe('buildStabilitySchedule', () => {
  it('keeps short smoke samples lightweight while checking content at both boundaries', () => {
    expect(buildStabilitySchedule({
      durationSeconds: 5,
      sampleSeconds: 1,
      contentSeconds: 2,
    })).toEqual([
      { atSeconds: 0, inspectContent: true },
      { atSeconds: 1, inspectContent: false },
      { atSeconds: 2, inspectContent: false },
      { atSeconds: 3, inspectContent: false },
      { atSeconds: 4, inspectContent: false },
      { atSeconds: 5, inspectContent: true },
    ]);
  });

  it('retains periodic content evidence for a full 20 minute run', () => {
    const schedule = buildStabilitySchedule({
      durationSeconds: 1200,
      sampleSeconds: 10,
      contentSeconds: 60,
    });

    expect(schedule).toHaveLength(121);
    expect(schedule.filter((entry) => entry.inspectContent)).toHaveLength(21);
    expect(schedule.at(0)).toEqual({ atSeconds: 0, inspectContent: true });
    expect(schedule.at(-1)).toEqual({ atSeconds: 1200, inspectContent: true });
  });

  it('rejects non-positive scheduling inputs', () => {
    expect(() => buildStabilitySchedule({
      durationSeconds: 0,
      sampleSeconds: 1,
      contentSeconds: 1,
    })).toThrow(/positive/);
  });
});

describe('resolveChromiumExecutable', () => {
  it('uses an explicit executable before platform candidates', () => {
    const isExecutable = vi.fn((path) => path === '/custom/chrome');

    expect(resolveChromiumExecutable({
      configuredPath: '/custom/chrome',
      candidates: ['/system/chromium'],
      isExecutable,
    })).toBe('/custom/chrome');
  });

  it('fails clearly when an explicit executable does not exist', () => {
    expect(() => resolveChromiumExecutable({
      configuredPath: '/missing/chrome',
      candidates: ['/system/chromium'],
      isExecutable: () => false,
    })).toThrow(/CHROMIUM_PATH.*missing\/chrome/);
  });

  it('selects the first executable platform candidate', () => {
    expect(resolveChromiumExecutable({
      candidates: ['/missing', '/usable', '/later'],
      isExecutable: (path) => path === '/usable' || path === '/later',
    })).toBe('/usable');
  });
});

describe('assertCanvasHealthy', () => {
  const healthy = {
    found: true,
    width: 1440,
    height: 900,
    contextLost: false,
    renderer: 'ANGLE Vulkan',
  };

  it('returns a healthy canvas state for diagnostics output', () => {
    expect(assertCanvasHealthy(healthy, 'game')).toBe(healthy);
  });

  it.each([
    [{ ...healthy, found: false }, /canvas was not found/],
    [{ ...healthy, width: 0 }, /zero-sized/],
    [{ ...healthy, contextLost: true }, /WebGL context is lost/],
  ])('rejects an invalid render gate: %o', (state, message) => {
    expect(() => assertCanvasHealthy(state, 'game')).toThrow(message);
  });
});

describe('summarizeRgbaPixels', () => {
  it('summarizes a varied opaque RGBA image without decoding assumptions', () => {
    const width = 16;
    const height = 16;
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        pixels[offset] = x * 17;
        pixels[offset + 1] = y * 17;
        pixels[offset + 2] = (x + y) * 8;
        pixels[offset + 3] = 255;
      }
    }

    const metrics = summarizeRgbaPixels(pixels, width, height);

    expect(metrics.sampleCount).toBe(256);
    expect(metrics.opaqueRatio).toBe(1);
    expect(metrics.luminanceRange).toBeGreaterThan(100);
    expect(metrics.luminanceStdDev).toBeGreaterThan(20);
    expect(metrics.colorBins).toBeGreaterThan(20);
  });

  it('reports a flat transparent image as empty content', () => {
    const metrics = summarizeRgbaPixels(new Uint8Array(16 * 16 * 4), 16, 16);

    expect(metrics.opaqueRatio).toBe(0);
    expect(metrics.luminanceRange).toBe(0);
    expect(metrics.luminanceStdDev).toBe(0);
    expect(metrics.colorBins).toBe(1);
  });
});

describe('assertFrameContent', () => {
  const healthy = {
    sampleCount: 1200,
    opaqueRatio: 1,
    luminanceRange: 96,
    luminanceStdDev: 24,
    colorBins: 48,
  };

  it('returns varied opaque captured-canvas metrics for diagnostics', () => {
    expect(assertFrameContent(healthy, 'game')).toBe(healthy);
  });

  it.each([
    [{ ...healthy, sampleCount: 20 }, /too few captured-canvas samples/],
    [{ ...healthy, opaqueRatio: 0.1 }, /mostly transparent/],
    [{ ...healthy, luminanceRange: 2 }, /luminance range/],
    [{ ...healthy, luminanceStdDev: 0.5 }, /luminance variance/],
    [{ ...healthy, colorBins: 2 }, /color variation/],
  ])('rejects visually empty captured-canvas metrics: %o', (metrics, message) => {
    expect(() => assertFrameContent(metrics, 'game')).toThrow(message);
  });
});

describe('summarizeStabilitySamples', () => {
  it('summarizes finite heap and FPS ranges without inventing thresholds', () => {
    const summary = summarizeStabilitySamples([
      { elapsedSeconds: 1, contextLost: false, usedHeap: 10, fps: '48', frame: {}, pointerLocked: true, simulationActive: true, weather: 'calm', daylight: 1, environmentRisk: 0.08, renderScale: 1, pixelRatio: 1.5, drawCalls: 18, triangles: 10_000, geometries: 22, textures: 8 },
      { elapsedSeconds: 11, contextLost: false, usedHeap: 14, fps: '52', pointerLocked: true, simulationActive: true, weather: 'rain', daylight: 0.45, environmentRisk: 0.58, renderScale: 0.8, pixelRatio: 1.2, drawCalls: 24, triangles: 12_000, geometries: 24, textures: 9 },
      { elapsedSeconds: 21, contextLost: false, usedHeap: 12, fps: '--', frame: {}, pointerLocked: true, simulationActive: true, weather: 'storm', daylight: 0, environmentRisk: 1, renderScale: 0.7, pixelRatio: 1.05, drawCalls: 21, triangles: 11_000, geometries: 23, textures: 9 },
    ], { requestedSeconds: 20, errors: [] });

    expect(summary).toMatchObject({
      requestedSeconds: 20,
      observedSeconds: 21,
      sampleCount: 3,
      contentSampleCount: 2,
      pointerLockedThroughout: true,
      simulationActiveThroughout: true,
      contextLost: false,
      heapStart: 10,
      heapEnd: 12,
      heapMin: 10,
      heapMax: 14,
      heapGrowth: 2,
      fpsMin: 48,
      fpsMax: 52,
      weatherKinds: ['calm', 'rain', 'storm'],
      daylightMin: 0,
      daylightMax: 1,
      environmentRiskMax: 1,
      renderScaleMin: 0.7,
      renderScaleMax: 1,
      pixelRatioMin: 1.05,
      pixelRatioMax: 1.5,
      drawCallsMax: 24,
      trianglesMax: 12_000,
      geometriesMax: 24,
      texturesMax: 9,
      errors: [],
    });
  });

  it('uses null instead of Infinity when optional browser metrics are absent', () => {
    const summary = summarizeStabilitySamples([], { requestedSeconds: 20, errors: ['page failed'] });

    expect(summary.observedSeconds).toBe(0);
    expect(summary.heapMin).toBeNull();
    expect(summary.heapMax).toBeNull();
    expect(summary.fpsMin).toBeNull();
    expect(summary.fpsMax).toBeNull();
    expect(summary.weatherKinds).toEqual([]);
    expect(summary.daylightMin).toBeNull();
    expect(summary.daylightMax).toBeNull();
    expect(summary.environmentRiskMax).toBeNull();
    expect(summary.renderScaleMin).toBeNull();
    expect(summary.renderScaleMax).toBeNull();
    expect(summary.pixelRatioMin).toBeNull();
    expect(summary.pixelRatioMax).toBeNull();
    expect(summary.drawCallsMax).toBeNull();
    expect(summary.trianglesMax).toBeNull();
    expect(summary.geometriesMax).toBeNull();
    expect(summary.texturesMax).toBeNull();
    expect(summary.contentSampleCount).toBe(0);
  });
});

describe('validateStabilitySummary', () => {
  const healthy = {
    requestedSeconds: 20,
    observedSeconds: 20,
    sampleCount: 3,
    contentSampleCount: 2,
    pointerLockedThroughout: true,
    simulationActiveThroughout: true,
    contextLost: false,
    heapGrowth: 4 * 1024 * 1024,
    fpsMin: 42,
    weatherKinds: ['calm', 'breeze', 'rain', 'storm'],
    daylightMin: 0,
    daylightMax: 1,
    errors: [],
  };
  const policy = {
    sampleSeconds: 10,
    minimumDurationRatio: 0.98,
    minimumSampleCoverage: 0.9,
    minimumContentSamples: 2,
    minimumFps: 20,
    minimumWeatherKinds: 4,
    minimumDaylightRange: 0.9,
    maximumHeapGrowthBytes: 16 * 1024 * 1024,
  };

  it('accepts a run that satisfies all declared thresholds', () => {
    expect(validateStabilitySummary(healthy, policy)).toEqual([]);
  });

  it('returns every failed gate instead of hiding partial evidence', () => {
    const failures = validateStabilitySummary({
      ...healthy,
      observedSeconds: 12,
      sampleCount: 1,
      contentSampleCount: 0,
      pointerLockedThroughout: false,
      simulationActiveThroughout: false,
      contextLost: true,
      heapGrowth: 40 * 1024 * 1024,
      fpsMin: 8,
      weatherKinds: ['calm'],
      daylightMin: 0.4,
      daylightMax: 0.5,
      errors: ['pageerror: boom'],
    }, policy);

    expect(failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/duration coverage/),
      expect.stringMatching(/sample coverage/),
      expect.stringMatching(/content samples/),
      expect.stringMatching(/pointer lock/),
      expect.stringMatching(/simulation was not active/),
      expect.stringMatching(/context was lost/),
      expect.stringMatching(/heap growth/),
      expect.stringMatching(/minimum FPS/),
      expect.stringMatching(/weather kinds/),
      expect.stringMatching(/daylight range/),
      expect.stringMatching(/browser errors/),
    ]));
  });

  it('fails when FPS or heap evidence is unavailable', () => {
    const failures = validateStabilitySummary({ ...healthy, fpsMin: null, heapGrowth: null }, policy);

    expect(failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/FPS evidence is unavailable/),
      expect.stringMatching(/heap evidence is unavailable/),
    ]));
  });
});

describe('isCriticalBrowserMessage', () => {
  it('treats console errors and context-loss warnings as failures', () => {
    expect(isCriticalBrowserMessage('error', 'shader compilation failed')).toBe(true);
    expect(isCriticalBrowserMessage('warning', 'WebGL: CONTEXT_LOST_WEBGL')).toBe(true);
  });

  it('keeps ordinary warnings diagnostic-only', () => {
    expect(isCriticalBrowserMessage('warning', 'GPU stall due to ReadPixels')).toBe(false);
  });
});
