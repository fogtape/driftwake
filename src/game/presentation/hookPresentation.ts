import { MathUtils } from 'three';

export const HOOK_ROPE_SEGMENTS = 18;

export type HookPresentationState = 'idle' | 'charging' | 'flying' | 'latched' | 'retracting';

export interface HookHandPose {
  toolX: number;
  toolY: number;
  toolZ: number;
  toolPitch: number;
  toolYaw: number;
  toolRoll: number;
  leftX: number;
  leftY: number;
  leftZ: number;
  leftPitch: number;
  leftYaw: number;
  leftRoll: number;
  leftGrip: number;
  rightX: number;
  rightY: number;
  rightZ: number;
  rightPitch: number;
  rightYaw: number;
  rightRoll: number;
  rightGrip: number;
}

export interface RopePoint {
  x: number;
  y: number;
  z: number;
}

export function createHookHandPose(): HookHandPose {
  return {
    toolX: 0.45,
    toolY: -0.61,
    toolZ: -0.84,
    toolPitch: -0.2,
    toolYaw: -0.25,
    toolRoll: -0.22,
    leftX: -0.32,
    leftY: -0.66,
    leftZ: -0.72,
    leftPitch: -0.2,
    leftYaw: -0.32,
    leftRoll: 0.1,
    leftGrip: 0.22,
    rightX: 0.42,
    rightY: -0.69,
    rightZ: -0.75,
    rightPitch: -0.08,
    rightYaw: 0.2,
    rightRoll: -0.16,
    rightGrip: 0.82,
  };
}

export function sampleHookHandPose(
  state: HookPresentationState,
  charge: number,
  time: number,
  castAge: number,
  tension: number,
  target: HookHandPose,
): HookHandPose {
  const breathing = Math.sin(time * 1.65);
  const recovery = Math.exp(-Math.max(0, castAge) * 4.4);
  const reel = Math.sin(time * 8.4);
  const braced = MathUtils.smoothstep(tension, 0.38, 0.92);

  target.toolX = 0.45 + breathing * 0.008;
  target.toolY = -0.61 + breathing * 0.006;
  target.toolZ = -0.84;
  target.toolPitch = -0.2;
  target.toolYaw = -0.25;
  target.toolRoll = -0.22 + breathing * 0.008;
  target.leftX = -0.32 - breathing * 0.006;
  target.leftY = -0.66 + breathing * 0.005;
  target.leftZ = -0.72;
  target.leftPitch = -0.2;
  target.leftYaw = -0.32;
  target.leftRoll = 0.1;
  target.leftGrip = 0.22;
  target.rightX = 0.42 + breathing * 0.005;
  target.rightY = -0.69 + breathing * 0.004;
  target.rightZ = -0.75;
  target.rightPitch = -0.08;
  target.rightYaw = 0.2;
  target.rightRoll = -0.16;
  target.rightGrip = 0.82;

  if (state === 'charging') {
    const pull = MathUtils.smootherstep(MathUtils.clamp(charge, 0, 1), 0, 1);
    target.toolX -= pull * 0.09;
    target.toolY -= pull * 0.055;
    target.toolZ += pull * 0.17;
    target.toolPitch -= pull * 0.24;
    target.toolRoll += pull * 0.38;
    target.rightX -= pull * 0.07;
    target.rightY -= pull * 0.04;
    target.rightZ += pull * 0.14;
    target.rightPitch -= pull * 0.18;
    target.rightRoll += pull * 0.26;
    target.leftX += pull * 0.3;
    target.leftY += pull * 0.2;
    target.leftZ -= pull * 0.09;
    target.leftPitch = -0.68 - pull * 0.18;
    target.leftYaw = -0.06;
    target.leftRoll = -0.42;
    target.leftGrip = 0.28 + pull * 0.62;
    return target;
  }

  if (state === 'flying') {
    target.toolZ -= recovery * 0.18;
    target.toolY += recovery * 0.09;
    target.toolPitch += recovery * 0.28;
    target.toolRoll -= recovery * 0.42;
    target.rightZ -= recovery * 0.12;
    target.rightY += recovery * 0.06;
    target.rightPitch += recovery * 0.22;
    target.leftX = -0.23 - recovery * 0.18;
    target.leftY = -0.53 + recovery * 0.08;
    target.leftZ = -0.7 - recovery * 0.12;
    target.leftPitch = -0.58;
    target.leftYaw = -0.12;
    target.leftRoll = -0.28;
    target.leftGrip = 0.62 - recovery * 0.28;
    target.rightGrip = 0.62;
    return target;
  }

  if (state === 'latched' || state === 'retracting') {
    const reeling = state === 'latched' ? 1 : 0.72;
    target.toolX -= braced * 0.08;
    target.toolY -= braced * 0.045;
    target.toolZ += braced * 0.08;
    target.toolPitch -= braced * 0.18;
    target.toolRoll += reel * 0.035 * reeling;
    target.rightX -= braced * 0.06;
    target.rightY -= braced * 0.035;
    target.rightZ += braced * 0.06;
    target.rightPitch -= braced * 0.16;
    target.rightRoll += reel * 0.035 * reeling;
    target.rightGrip = 0.92;
    target.leftX = -0.1 + reel * 0.035 * reeling;
    target.leftY = -0.46 + Math.abs(reel) * 0.025;
    target.leftZ = -0.7 - braced * 0.05;
    target.leftPitch = -0.72 + reel * 0.08 * reeling;
    target.leftYaw = -0.08;
    target.leftRoll = -0.46 + reel * 0.12 * reeling;
    target.leftGrip = 0.78 + braced * 0.18;
  }
  return target;
}

export function sampleHookRopeTension(state: HookPresentationState, distance: number): number {
  if (state === 'latched') return MathUtils.clamp(0.76 + distance / 90, 0.76, 0.98);
  if (state === 'retracting') return MathUtils.clamp(0.62 + distance / 75, 0.62, 0.94);
  if (state === 'flying') return MathUtils.clamp(0.28 + distance / 62, 0.28, 0.76);
  return 0;
}

export function sampleHookRopeSag(distance: number, tension: number): number {
  if (distance <= 0) return 0;
  const normalizedTension = MathUtils.clamp(tension, 0, 1);
  const sagRatio = MathUtils.lerp(0.068, 0.007, Math.pow(normalizedTension, 1.45));
  return MathUtils.clamp(distance * sagRatio, 0.012, 1.25);
}

export function writeHookRopeCurve(
  positions: Float32Array,
  start: RopePoint,
  end: RopePoint,
  tension: number,
  phase: number,
): number {
  const pointCount = HOOK_ROPE_SEGMENTS + 1;
  if (positions.length < pointCount * 3) throw new Error('Hook rope buffer is too small');
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const distance = Math.hypot(dx, dy, dz);
  const horizontal = Math.hypot(dx, dz);
  const sideX = horizontal > 0.0001 ? -dz / horizontal : 1;
  const sideZ = horizontal > 0.0001 ? dx / horizontal : 0;
  const sag = sampleHookRopeSag(distance, tension);
  const flutterStrength = Math.min(0.045, distance * 0.0028) * (1 - MathUtils.clamp(tension, 0, 1));

  for (let index = 0; index < pointCount; index += 1) {
    const alpha = index / HOOK_ROPE_SEGMENTS;
    const envelope = Math.pow(Math.sin(Math.PI * alpha), 1.25);
    const flutter = Math.sin(phase * 5.2 + alpha * Math.PI * 4) * envelope * flutterStrength;
    const offset = index * 3;
    positions[offset] = start.x + dx * alpha + sideX * flutter;
    positions[offset + 1] = start.y + dy * alpha - envelope * sag;
    positions[offset + 2] = start.z + dz * alpha + sideZ * flutter;
  }
  return sag;
}
