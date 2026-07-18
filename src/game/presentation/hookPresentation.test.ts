import { describe, expect, it } from 'vitest';
import {
  HOOK_ROPE_SEGMENTS,
  createHookHandPose,
  sampleHookHandPose,
  sampleHookRopeSag,
  sampleHookRopeTension,
  writeHookRopeCurve,
  type HookPresentationState,
} from './hookPresentation';

describe('hook first-person presentation', () => {
  it('keeps rope endpoints fixed while tension reduces the catenary sag', () => {
    const start = { x: -1.5, y: 2.4, z: 3.2 };
    const end = { x: 8.5, y: 2.4, z: -4.8 };
    const loose = new Float32Array((HOOK_ROPE_SEGMENTS + 1) * 3);
    const taut = new Float32Array((HOOK_ROPE_SEGMENTS + 1) * 3);
    const looseSag = writeHookRopeCurve(loose, start, end, 0.28, 2.5);
    const tautSag = writeHookRopeCurve(taut, start, end, 0.94, 2.5);
    const finalOffset = HOOK_ROPE_SEGMENTS * 3;

    expect(loose[0]).toBeCloseTo(start.x, 5);
    expect(loose[1]).toBeCloseTo(start.y, 5);
    expect(loose[2]).toBeCloseTo(start.z, 5);
    expect(loose[finalOffset]).toBeCloseTo(end.x, 5);
    expect(loose[finalOffset + 1]).toBeCloseTo(end.y, 5);
    expect(loose[finalOffset + 2]).toBeCloseTo(end.z, 5);
    expect(looseSag).toBeGreaterThan(tautSag);
    expect(loose[HOOK_ROPE_SEGMENTS / 2 * 3 + 1]).toBeLessThan(taut[HOOK_ROPE_SEGMENTS / 2 * 3 + 1]);
    expect(Array.from(loose).every(Number.isFinite)).toBe(true);
  });

  it('rejects undersized rope buffers instead of writing partial geometry', () => {
    expect(() => writeHookRopeCurve(new Float32Array(6), { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0.5, 0))
      .toThrow('Hook rope buffer is too small');
  });

  it('maps deployed distance to bounded tension and finite sag', () => {
    expect(sampleHookRopeTension('idle', 30)).toBe(0);
    expect(sampleHookRopeTension('flying', 30)).toBeGreaterThan(0.28);
    expect(sampleHookRopeTension('latched', 30)).toBeGreaterThan(sampleHookRopeTension('retracting', 30));
    expect(sampleHookRopeTension('latched', 1_000)).toBeLessThanOrEqual(1);
    expect(sampleHookRopeSag(18, 0.2)).toBeGreaterThan(sampleHookRopeSag(18, 0.9));
  });

  it('samples distinct, bounded hand poses for every hook state', () => {
    const states: HookPresentationState[] = ['idle', 'charging', 'flying', 'latched', 'retracting'];
    for (const state of states) {
      const pose = sampleHookHandPose(state, 0.82, 4.25, 0.08, 0.88, createHookHandPose());
      expect(Object.values(pose).every(Number.isFinite)).toBe(true);
      expect(pose.leftGrip).toBeGreaterThanOrEqual(0);
      expect(pose.leftGrip).toBeLessThanOrEqual(1);
      expect(pose.rightGrip).toBeGreaterThanOrEqual(0);
      expect(pose.rightGrip).toBeLessThanOrEqual(1);
    }

    const idle = sampleHookHandPose('idle', 0, 4.25, 0, 0, createHookHandPose());
    const charged = sampleHookHandPose('charging', 1, 4.25, 0, 0, createHookHandPose());
    const latched = sampleHookHandPose('latched', 0, 4.25, 1, 0.95, createHookHandPose());
    expect(charged.leftX).toBeGreaterThan(idle.leftX + 0.2);
    expect(charged.toolZ).toBeGreaterThan(idle.toolZ + 0.1);
    expect(latched.leftGrip).toBeGreaterThan(idle.leftGrip + 0.6);
    expect(latched.toolX).toBeLessThan(idle.toolX);
  });
});
