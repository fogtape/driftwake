import { Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import type { MaterialLibrary } from './Materials';
import { createCollectionNetModel, updateCollectionNetModel, type CollectionNetModelVisuals } from './CollectionNetModel';

function testMaterials(): MaterialLibrary {
  const material = () => new MeshStandardMaterial();
  return {
    wood: [material(), material(), material()],
    darkWood: material(),
    rope: material(),
    rustMetal: material(),
    structureFastener: material(),
    polymer: material(),
  } as MaterialLibrary;
}

describe('collection-net original model', () => {
  it('keeps the woven silhouette dense while batching static material groups', () => {
    const materials = testMaterials();
    const model = createCollectionNetModel(materials);
    const meshes: Mesh[] = [];
    model.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    expect(meshes.length).toBeLessThanOrEqual(15);
    expect(meshes.length).toBeGreaterThanOrEqual(12);
    const woven = model.getObjectByName('collection-net-woven-bed') as Mesh;
    woven.geometry.computeBoundingBox();
    expect(woven.geometry.getAttribute('position').count).toBeGreaterThan(1_000);
    expect(woven.geometry.boundingBox?.min.y).toBeLessThan(-0.2);
    expect(woven.geometry.boundingBox?.max.x).toBeGreaterThan(0.5);
    expect((model.getObjectByName('collection-net-edge-clamps') as Mesh).material).toBe(materials.structureFastener);
    expect(model.userData.materialMaps.split('|')).toHaveLength(15);
  });

  it('reveals cargo, wear and the full marker from runtime state without changing layout', () => {
    const model = createCollectionNetModel(testMaterials());
    const visuals = model.userData.collectionNetVisuals as CollectionNetModelVisuals;
    updateCollectionNetModel(visuals, 2, 0.5, 0.6);
    expect(visuals.cargoMarkers.filter((marker) => marker.visible)).toHaveLength(3);
    expect(visuals.wearRopes[0].visible).toBe(true);
    expect(visuals.wearRopes[1].visible).toBe(false);
    expect(visuals.fullMarker.visible).toBe(false);
    updateCollectionNetModel(visuals, 3, 1, 0.3);
    expect(visuals.cargoMarkers.every((marker) => marker.visible)).toBe(true);
    expect(visuals.wearRopes.every((rope) => rope.visible)).toBe(true);
    expect(visuals.fullMarker.visible).toBe(true);
  });
});
