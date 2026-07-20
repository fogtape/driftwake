import { Box3, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createHookHandPose, sampleHookHandPose } from '../presentation/hookPresentation';
import type { MaterialLibrary } from './Materials';
import { createSalvageHandsRig } from './FirstPersonModels';

function createTestMaterials(): MaterialLibrary {
  const material = () => new MeshStandardMaterial();
  return {
    wood: [material(), material(), material()],
    darkWood: material(),
    rope: material(),
    metal: material(),
    rustMetal: material(),
    polymer: material(),
    leaf: material(),
    rock: material(),
    foliage: material(),
    wovenFiber: material(),
    sharkSkin: material(),
    sharkMouth: material(),
    sharkEye: material(),
    reefSeabed: material(),
    reefRock: material(),
    coralWarm: material(),
    coralPale: material(),
    seaweed: material(),
    ore: material(),
    clay: material(),
    reefFish: material(),
    reefCaustic: new MeshBasicMaterial(),
    sailCloth: material(),
    planterSoil: material(),
    refractoryClay: material(),
    navigationAlloy: material(),
    saltglassCollector: material(),
    sealedCanvas: material(),
    saltsealedGlove: material(),
    signalLaminate: material(),
    phosphorGlass: material(),
    cropLeaf: material(),
    cropDry: material(),
    cropFruit: material(),
    birdFeather: material(),
    birdWing: material(),
    birdBeak: material(),
    birdEye: material(),
    silverSpineSkin: material(),
    amberFinSkin: material(),
    sailtailRunnerSkin: material(),
    fishFlesh: material(),
    fishEye: material(),
  };
}

describe('first-person salvage hands', () => {
  it('builds a dense two-hand glove rig with separate tool and rope anchors', () => {
    const materials = createTestMaterials();
    const rig = createSalvageHandsRig(materials);
    const pose = sampleHookHandPose('charging', 0.78, 2.4, 0, 0, createHookHandPose());
    rig.applyPose(pose);
    rig.root.updateMatrixWorld(true);

    let meshCount = 0;
    let canvasParts = 0;
    rig.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshCount += 1;
      if (object.material === materials.saltsealedGlove) canvasParts += 1;
      const position = object.geometry.getAttribute('position');
      expect(position?.count ?? 0).toBeGreaterThan(0);
    });
    const size = new Box3().setFromObject(rig.root).getSize(new Vector3());
    const guidePosition = rig.ropeGuide.getWorldPosition(new Vector3());
    const castPosition = rig.castOrigin.getWorldPosition(new Vector3());

    expect(meshCount).toBeGreaterThanOrEqual(40);
    expect(canvasParts).toBeGreaterThanOrEqual(20);
    expect(size.x).toBeGreaterThan(0.7);
    expect(size.y).toBeGreaterThan(0.6);
    expect(size.z).toBeGreaterThan(0.25);
    expect(rig.heldHook.parent).toBe(rig.toolPivot);
    expect(rig.ropeGuide.parent).toBe(rig.leftWrist);
    expect(rig.castOrigin.parent).toBe(rig.toolPivot);
    expect(guidePosition.distanceTo(castPosition)).toBeGreaterThan(0.08);
  });

  it('drives finger joints and wrists without changing rig ownership', () => {
    const rig = createSalvageHandsRig(createTestMaterials());
    const idle = createHookHandPose();
    rig.applyPose(idle);
    const finger = rig.leftWrist.getObjectByName('left-finger-1-pivot');
    const idleCurl = finger?.rotation.x ?? 0;
    const reeling = sampleHookHandPose('latched', 0, 3.8, 0.7, 0.96, createHookHandPose());
    rig.applyPose(reeling);

    expect(finger?.rotation.x).toBeGreaterThan(idleCurl + 0.5);
    expect(rig.leftWrist.position.x).toBeCloseTo(reeling.leftX, 5);
    expect(rig.rightWrist.position.z).toBeCloseTo(reeling.rightZ, 5);
    expect(rig.heldHook.parent).toBe(rig.toolPivot);
  });
});
