import { describe, expect, it } from 'vitest';
import {
  assertEncodedFrameContent,
  buildStabilitySchedule,
  isSoftwareRenderer,
  resolveStabilityProfile,
  summarizeStabilitySamples,
  validateStabilitySummary,
} from './capture-utils.mjs';

describe('stability utilities', () => {
  it('builds exact periodic and final checkpoints without duplicates', () => {
    expect(buildStabilitySchedule({ durationSeconds: 25, sampleSeconds: 10, contentSeconds: 20 })).toEqual([
      { atSeconds: 0, inspectContent: true },
      { atSeconds: 10, inspectContent: false },
      { atSeconds: 20, inspectContent: true },
      { atSeconds: 25, inspectContent: true },
    ]);
  });

  it('resolves target profiles and recognizes common software renderers', () => {
    expect(resolveStabilityProfile({ quality: 'high' })).toMatchObject({
      viewportWidth: 1920,
      viewportHeight: 1080,
      minimumFps: 60,
    });
    expect(isSoftwareRenderer('ANGLE (Google, Vulkan 1.3 SwiftShader)')).toBe(true);
    expect(isSoftwareRenderer('NVIDIA GeForce RTX 4060')).toBe(false);
  });

  it('rejects undersized composited canvas evidence', () => {
    expect(() => assertEncodedFrameContent({ contextLost: false, width: 1280, height: 720, encodedBytes: 30_000 }, 'frame')).not.toThrow();
    expect(() => assertEncodedFrameContent({ contextLost: false, width: 1280, height: 720, encodedBytes: 2_000 }, 'frame')).toThrow(/blank/);
  });

  it('summarizes retained heap slope and dynamic collider evidence', () => {
    const samples = Array.from({ length: 6 }, (_, index) => ({
      elapsedSeconds: index * 10,
      usedHeap: 10_000_000 + index * 100_000,
      fps: 60,
      frameP95Ms: 17,
      renderScale: 1,
      pixelRatio: 1,
      drawCalls: 140 + index,
      triangles: 80_000 + index * 10,
      geometries: 119,
      textures: 8,
      simulationTickCount: index * 600,
      droppedSimulationSeconds: 0,
      raftColliderCount: 9,
      raftTileCount: 9,
      debrisCount: 30,
      quality: 'high',
      pointerLocked: true,
      simulationActive: true,
      contextLost: false,
      frameContent: index % 2 === 0 ? { variation: 20, nonBlack: 100 } : null,
      playerSurface: 'raft',
      playerAirborne: index === 2,
      frameDriver: 'native',
    }));
    const summary = summarizeStabilitySamples(samples, { requestedSeconds: 50 });
    expect(summary.retainedHeapGrowth).toBeGreaterThan(0);
    expect(summary.heapSlopeBytesPerMinute).toBeGreaterThan(0);
    expect(summary.raftColliderCountMin).toBe(9);
    expect(summary.observedAirborne).toBe(true);
    expect(summary.frameDrivers).toEqual(['native']);
    expect(summary.drawCallsMax).toBe(145);
    expect(summary.trianglesMax).toBe(80_050);
    expect(summary.geometriesMin).toBe(summary.geometriesMax);
    expect(summary.texturesMin).toBe(summary.texturesMax);
    expect(summary.simulationTickCountEnd).toBe(3_000);
  });

  it('rejects renderer, ownership, heap and collider false positives', () => {
    const summary = {
      requestedSeconds: 20,
      observedSeconds: 20,
      sampleCount: 3,
      contentSampleCount: 2,
      pointerLockedThroughout: true,
      simulationActiveThroughout: true,
      contextLost: false,
      errors: [],
      fpsP10: 60,
      renderScaleMin: 1,
      retainedHeapGrowth: 0,
      heapSlopeBytesPerMinute: 0,
      raftColliderCountMin: 8,
      raftColliderCountMax: 8,
      raftTileCountMin: 9,
      raftTileCountMax: 9,
      droppedSimulationSecondsMax: 0,
      qualityKinds: ['high'],
      debrisCountMin: 30,
      debrisCountMax: 30,
      renderer: 'SwiftShader',
      frameDrivers: ['fallback'],
    };
    const failures = validateStabilitySummary(summary, {
      sampleSeconds: 10,
      minimumDurationRatio: 0.98,
      minimumSampleCoverage: 0.9,
      minimumContentSamples: 2,
      minimumFps: 30,
      minimumRenderScale: 1,
      maximumRetainedHeapGrowthBytes: 32 * 1024 * 1024,
      maximumHeapSlopeBytesPerMinute: 1024 * 1024,
      maximumDroppedSimulationSeconds: 0.5,
      allowSoftwareRenderer: false,
      requireNativeFrameDriver: true,
      quality: 'high',
      expectedDebrisCount: 30,
    });
    expect(failures).toContain('raft collider count diverged from dynamic tile count');
    expect(failures).toContain('software renderer is not allowed');
    expect(failures).toContain('native animation frame driver was not held throughout');
  });
});
