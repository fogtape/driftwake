import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  TorusGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { HookHandPose } from '../presentation/hookPresentation';
import type { MaterialLibrary } from './Materials';
import { createHookModel } from './ProceduralModels';

export interface SalvageHandsRig {
  root: Group;
  heldHook: Group;
  toolPivot: Group;
  leftWrist: Group;
  rightWrist: Group;
  ropeGuide: Group;
  castOrigin: Group;
  applyPose: (pose: HookHandPose) => void;
}

interface GloveAssembly {
  root: Group;
  fingerPivots: Group[];
  thumbPivot: Group;
}

function mesh(geometry: Mesh['geometry'], material: Mesh['material'], name?: string): Mesh {
  const result = new Mesh(geometry, material);
  result.castShadow = false;
  result.receiveShadow = false;
  if (name) result.name = name;
  return result;
}

function createGlove(materials: MaterialLibrary, side: 'left' | 'right'): GloveAssembly {
  const root = new Group();
  root.name = `${side}-saltsealed-glove`;
  const mirror = side === 'left' ? -1 : 1;

  const forearm = mesh(new CylinderGeometry(0.105, 0.145, 0.4, 12), materials.saltsealedGlove, `${side}-forearm`);
  forearm.position.y = -0.25;
  forearm.rotation.z = mirror * -0.05;
  root.add(forearm);

  const cuff = mesh(new CylinderGeometry(0.13, 0.125, 0.105, 12), materials.wovenFiber, `${side}-woven-cuff`);
  cuff.position.y = -0.045;
  root.add(cuff);

  const cuffRim = mesh(new TorusGeometry(0.132, 0.012, 6, 18), materials.rope, `${side}-cuff-rope`);
  cuffRim.position.y = 0.005;
  cuffRim.rotation.x = Math.PI / 2;
  root.add(cuffRim);

  const palm = mesh(new RoundedBoxGeometry(0.25, 0.27, 0.13, 4, 0.035), materials.saltsealedGlove, `${side}-palm`);
  palm.position.y = 0.115;
  root.add(palm);

  const palmGuard = mesh(new RoundedBoxGeometry(0.205, 0.19, 0.018, 3, 0.012), materials.wovenFiber, `${side}-palm-guard`);
  palmGuard.position.set(0, 0.12, -0.071);
  root.add(palmGuard);

  const knuckleBar = mesh(new RoundedBoxGeometry(0.215, 0.042, 0.145, 3, 0.014), materials.wovenFiber, `${side}-knuckle-guard`);
  knuckleBar.position.y = 0.235;
  root.add(knuckleBar);

  const buckle = mesh(new BoxGeometry(0.07, 0.045, 0.025), materials.rustMetal, `${side}-cuff-buckle`);
  buckle.position.set(mirror * 0.12, -0.04, 0.035);
  root.add(buckle);
  const buckleTongue = mesh(new BoxGeometry(0.018, 0.07, 0.016), materials.metal, `${side}-buckle-tongue`);
  buckleTongue.position.set(mirror * 0.12, -0.04, 0.051);
  root.add(buckleTongue);

  const fingerPivots: Group[] = [];
  const fingerXs = [-0.082, -0.027, 0.027, 0.082];
  for (let index = 0; index < fingerXs.length; index += 1) {
    const pivot = new Group();
    pivot.name = `${side}-finger-${index}-pivot`;
    pivot.position.set(fingerXs[index], 0.245, -0.004);
    const proximal = mesh(
      new RoundedBoxGeometry(0.047, 0.12 - Math.abs(index - 1.5) * 0.009, 0.07, 3, 0.018),
      materials.saltsealedGlove,
      `${side}-finger-${index}-proximal`,
    );
    proximal.position.y = 0.05;
    const distalPivot = new Group();
    distalPivot.position.y = 0.102;
    const distal = mesh(
      new RoundedBoxGeometry(0.045, 0.09 - Math.abs(index - 1.5) * 0.007, 0.067, 3, 0.017),
      materials.saltsealedGlove,
      `${side}-finger-${index}-distal`,
    );
    distal.position.y = 0.035;
    distalPivot.add(distal);
    pivot.add(proximal, distalPivot);
    pivot.userData.distalPivot = distalPivot;
    root.add(pivot);
    fingerPivots.push(pivot);
  }

  const thumbPivot = new Group();
  thumbPivot.name = `${side}-thumb-pivot`;
  thumbPivot.position.set(mirror * 0.132, 0.135, -0.005);
  thumbPivot.rotation.z = mirror * -0.72;
  const thumb = mesh(new RoundedBoxGeometry(0.07, 0.16, 0.08, 3, 0.022), materials.saltsealedGlove, `${side}-thumb`);
  thumb.position.y = 0.055;
  thumbPivot.add(thumb);
  root.add(thumbPivot);

  return { root, fingerPivots, thumbPivot };
}

function applyGrip(glove: GloveAssembly, grip: number, side: 'left' | 'right'): void {
  const clamped = Math.max(0, Math.min(1, grip));
  glove.fingerPivots.forEach((pivot, index) => {
    pivot.rotation.x = 0.08 + clamped * (0.88 + index * 0.035);
    pivot.rotation.z = (side === 'left' ? -1 : 1) * (index - 1.5) * 0.018;
    const distalPivot = pivot.userData.distalPivot as Group;
    distalPivot.rotation.x = clamped * 1.18;
  });
  glove.thumbPivot.rotation.x = clamped * 0.48;
  glove.thumbPivot.rotation.z = (side === 'left' ? 1 : -1) * (0.7 + clamped * 0.25);
}

export function createSalvageHandsRig(materials: MaterialLibrary): SalvageHandsRig {
  const root = new Group();
  root.name = 'first-person-salvage-hands';
  root.renderOrder = 8;

  const left = createGlove(materials, 'left');
  const right = createGlove(materials, 'right');
  const leftWrist = left.root;
  const rightWrist = right.root;
  root.add(leftWrist, rightWrist);

  const toolPivot = new Group();
  toolPivot.name = 'held-hook-pivot';
  const heldHook = createHookModel(materials);
  heldHook.name = 'held-salvaged-hook';
  heldHook.scale.setScalar(0.72);
  toolPivot.add(heldHook);
  root.add(toolPivot);

  const ropeGuide = new Group();
  ropeGuide.name = 'left-hand-rope-guide';
  ropeGuide.position.set(0.02, 0.31, -0.06);
  leftWrist.add(ropeGuide);

  const castOrigin = new Group();
  castOrigin.name = 'held-hook-cast-origin';
  castOrigin.position.set(0.02, 0.62, -0.01);
  toolPivot.add(castOrigin);

  const applyPose = (pose: HookHandPose): void => {
    toolPivot.position.set(pose.toolX, pose.toolY, pose.toolZ);
    toolPivot.rotation.set(pose.toolPitch, pose.toolYaw, pose.toolRoll);
    leftWrist.position.set(pose.leftX, pose.leftY, pose.leftZ);
    leftWrist.rotation.set(pose.leftPitch, pose.leftYaw, pose.leftRoll);
    rightWrist.position.set(pose.rightX, pose.rightY, pose.rightZ);
    rightWrist.rotation.set(pose.rightPitch, pose.rightYaw, pose.rightRoll);
    applyGrip(left, pose.leftGrip, 'left');
    applyGrip(right, pose.rightGrip, 'right');
  };

  return { root, heldHook, toolPivot, leftWrist, rightWrist, ropeGuide, castOrigin, applyPose };
}
