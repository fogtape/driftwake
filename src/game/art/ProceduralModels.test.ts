import { Box3, Group, InstancedMesh, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { MaterialLibrary } from './Materials';
import {
  createAxeModel,
  createExplorableIsland,
  createFishingRodModel,
  createGrillModel,
  createHammerModel,
  createHarvestNodeModel,
  createPurifierModel,
  createSharkModel,
  createSpearModel,
} from './ProceduralModels';

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
  };
}

function meshStats(root: Group): { meshes: number; vertices: number } {
  let meshes = 0;
  let vertices = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshes += 1;
    const position = object.geometry.getAttribute('position');
    vertices += position?.count ?? 0;
    for (let index = 0; position && index < position.count; index += 1) {
      expect(Number.isFinite(position.getX(index))).toBe(true);
      expect(Number.isFinite(position.getY(index))).toBe(true);
      expect(Number.isFinite(position.getZ(index))).toBe(true);
    }
  });
  return { meshes, vertices };
}

function renderedPartCount(root: Group): number {
  let parts = 0;
  root.traverse((object) => {
    if (object instanceof InstancedMesh) parts += object.count;
    else if (object instanceof Mesh) parts += 1;
  });
  return parts;
}

describe('procedural model assets', () => {
  it('builds a non-degenerate articulated shark silhouette', () => {
    const shark = createSharkModel(createTestMaterials());
    const stats = meshStats(shark);
    const size = new Box3().setFromObject(shark).getSize(new Vector3());
    expect(stats.meshes).toBeGreaterThanOrEqual(12);
    expect(stats.vertices).toBeGreaterThan(500);
    expect(size.z).toBeGreaterThan(3.5);
    expect(size.x).toBeGreaterThan(2);
    expect(shark.userData.tailPivot).toBeDefined();
  }, 15_000);

  it('gives each first-person tool a distinct detailed mesh assembly', () => {
    const materials = createTestMaterials();
    const tools = [
      createHammerModel(materials),
      createSpearModel(materials),
      createFishingRodModel(materials),
      createAxeModel(materials),
    ];
    const meshCounts = tools.map((tool) => meshStats(tool).meshes);
    expect(meshCounts[0]).toBeGreaterThanOrEqual(9);
    expect(meshCounts[1]).toBeGreaterThanOrEqual(7);
    expect(meshCounts[2]).toBeGreaterThanOrEqual(4);
    expect(meshCounts[3]).toBeGreaterThanOrEqual(4);
    expect(renderedPartCount(tools[3])).toBeGreaterThanOrEqual(9);
  }, 15_000);

  it('builds readable purifier and grill assemblies with animated state references', () => {
    const materials = createTestMaterials();
    const purifier = createPurifierModel(materials);
    const grill = createGrillModel(materials);
    const purifierSize = new Box3().setFromObject(purifier).getSize(new Vector3());
    const grillSize = new Box3().setFromObject(grill).getSize(new Vector3());
    expect(meshStats(purifier).meshes).toBeGreaterThanOrEqual(35);
    expect(meshStats(grill).meshes).toBeGreaterThanOrEqual(40);
    expect(purifierSize.y).toBeGreaterThan(0.82);
    expect(grillSize.x).toBeGreaterThan(0.8);
    expect(purifier.userData.deviceVisuals.cleanWater).toBeDefined();
    expect(grill.userData.deviceVisuals.foodMeshes.length).toBeGreaterThanOrEqual(3);
  }, 15_000);

  it('builds an explorable heightfield island with shoreline and collision landmarks', () => {
    const island = createExplorableIsland(createTestMaterials(), 0x51ad7e);
    const terrain = island.getObjectByName('island-heightfield') as Mesh;
    const size = new Box3().setFromObject(island).getSize(new Vector3());
    expect(terrain.geometry.getAttribute('position').count).toBeGreaterThan(2_000);
    expect(island.userData.islandVisuals.foam).toHaveLength(30);
    expect(island.userData.islandVisuals.obstacles).toHaveLength(5);
    expect(size.x).toBeGreaterThan(12);
    expect(size.z).toBeGreaterThan(12);
    expect(size.y).toBeGreaterThan(2.2);
  }, 15_000);

  it('gives every harvest node a readable mesh and interaction highlight', () => {
    const materials = createTestMaterials();
    const types = ['palm', 'branch', 'stone', 'fruit', 'fiber'] as const;
    const nodes = types.map((type) => createHarvestNodeModel(type, materials));
    const counts = nodes.map((node) => meshStats(node).meshes);
    const parts = nodes.map(renderedPartCount);
    expect(counts[0]).toBeLessThanOrEqual(6);
    expect(parts[0]).toBeGreaterThanOrEqual(22);
    expect(parts.slice(1).every((count) => count >= 5)).toBe(true);
    nodes.forEach((node) => {
      expect(node.userData.harvestVisuals.pivot).toBeDefined();
      expect(node.userData.harvestVisuals.highlight).toBeDefined();
    });
  }, 15_000);
});
