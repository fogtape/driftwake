export type CameraMotionMode = 'comfort' | 'balanced' | 'immersive';

export interface CameraMotionProfile {
  headBobScale: number;
  raftTiltScale: number;
  maximumTiltSpeed: number;
}

export const CAMERA_MOTION_PROFILES: Readonly<Record<CameraMotionMode, CameraMotionProfile>> = {
  comfort: { headBobScale: 0, raftTiltScale: 0.08, maximumTiltSpeed: 0.42 },
  balanced: { headBobScale: 0.55, raftTiltScale: 0.4, maximumTiltSpeed: 0.7 },
  immersive: { headBobScale: 1, raftTiltScale: 0.82, maximumTiltSpeed: 1.25 },
};
