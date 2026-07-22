export type CameraMotionMode = 'comfort' | 'balanced' | 'immersive';
export const COLOR_VISION_MODES = ['standard', 'deuteranopia', 'protanopia', 'tritanopia', 'highContrast'] as const;
export type ColorVisionMode = (typeof COLOR_VISION_MODES)[number];

export const COLOR_VISION_MODE_LABELS: Readonly<Record<ColorVisionMode, string>> = {
  standard: '标准',
  deuteranopia: '绿弱',
  protanopia: '红弱',
  tritanopia: '蓝弱',
  highContrast: '高对比',
};

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
