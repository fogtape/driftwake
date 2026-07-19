import { Box3, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { MaterialLibrary } from './Materials';
import {
  createAxeModel,
  createDebrisModel,
  createExplorableIsland,
  createFishingRodModel,
  createGrillModel,
  createHammerModel,
  createHarvestNodeModel,
  createPurifierModel,
  createResonanceForkModel,
  createSharkModel,
  createSharkLootDropModel,
  createSpearModel,
} from './ProceduralModels';
import { createReefModel, createReefNodeModel } from './UnderwaterModels';
import { createAnchorModel, createHelmModel, createSailModel } from './NavigationModels';
import { createPlanterModel, createSaltwingBirdModel } from './PlantingModels';
import { createDryingRackModel, createResearchBenchModel, createSmelterModel } from './ProgressionModels';
import { createLockerModel, createSolarPurifierModel, createTripleGrillModel } from './AdvancedDeviceModels';
import { createAntennaModel, createReceiverModel, createSignalBeaconModel } from './SignalModels';

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
  it('gives the salvage barrel a distinct banded silhouette', () => {
    const barrel = createDebrisModel('barrel', createTestMaterials());
    const stats = meshStats(barrel);
    const size = new Box3().setFromObject(barrel).getSize(new Vector3());
    expect(stats.meshes).toBeGreaterThanOrEqual(5);
    expect(size.x).toBeGreaterThan(0.75);
    expect(size.y).toBeGreaterThan(0.6);
    expect(barrel.userData.kind).toBe('barrel');
  });

  it('builds a non-degenerate articulated shark silhouette', () => {
    const shark = createSharkModel(createTestMaterials());
    const stats = meshStats(shark);
    const size = new Box3().setFromObject(shark).getSize(new Vector3());
    expect(stats.meshes).toBeGreaterThanOrEqual(12);
    expect(stats.vertices).toBeGreaterThan(500);
    expect(size.z).toBeGreaterThan(3.5);
    expect(size.x).toBeGreaterThan(2);
    expect(shark.userData.tailPivot).toBeDefined();
    expect(shark.userData.harvestMarks).toHaveLength(3);
  }, 15_000);

  it('builds a distinct bound shark-harvest bundle for rejected loot', () => {
    const bundle = createSharkLootDropModel(createTestMaterials());
    const stats = meshStats(bundle);
    const size = new Box3().setFromObject(bundle).getSize(new Vector3());
    expect(stats.meshes).toBeGreaterThanOrEqual(8);
    expect(size.x).toBeGreaterThan(0.8);
    expect(size.y).toBeGreaterThan(0.3);
    expect(bundle.userData.kind).toBe('sharkLoot');
  });

  it('gives each first-person tool a distinct detailed mesh assembly', () => {
    const materials = createTestMaterials();
    const tools = [
      createHammerModel(materials),
      createSpearModel(materials),
      createFishingRodModel(materials),
      createAxeModel(materials),
      createResonanceForkModel(materials),
    ];
    const meshCounts = tools.map((tool) => meshStats(tool).meshes);
    expect(meshCounts[0]).toBeGreaterThanOrEqual(9);
    expect(meshCounts[1]).toBeGreaterThanOrEqual(7);
    expect(meshCounts[2]).toBeGreaterThanOrEqual(4);
    expect(meshCounts[3]).toBeGreaterThanOrEqual(4);
    expect(meshCounts[4]).toBeGreaterThanOrEqual(22);
    expect(renderedPartCount(tools[3])).toBeGreaterThanOrEqual(9);
    expect(meshStats(createSpearModel(materials, true)).meshes).toBeGreaterThan(meshCounts[1]);
    expect(meshStats(createAxeModel(materials, true)).meshes).toBeGreaterThan(meshCounts[3]);
    expect(createResonanceForkModel(materials).userData.resonanceVisuals.chargeRings).toHaveLength(3);
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

  it('builds high-detail advanced survival devices with per-slot visual references', () => {
    const materials = createTestMaterials();
    const solar = createSolarPurifierModel(materials);
    const grill = createTripleGrillModel(materials);
    const locker = createLockerModel(materials);
    expect(meshStats(solar).meshes).toBeGreaterThanOrEqual(55);
    expect(meshStats(grill).meshes).toBeGreaterThanOrEqual(70);
    expect(meshStats(locker).meshes).toBeGreaterThanOrEqual(25);
    expect(solar.userData.deviceVisuals.waterCells).toHaveLength(5);
    expect(grill.userData.deviceVisuals.foodSlots).toHaveLength(3);
    expect(grill.userData.deviceVisuals.fuelBars).toHaveLength(4);
    expect(locker.userData.deviceVisuals.storageMarkers).toHaveLength(8);
    expect(new Box3().setFromObject(solar).getSize(new Vector3()).x).toBeGreaterThan(1.05);
    expect(new Box3().setFromObject(locker).getSize(new Vector3()).y).toBeGreaterThan(0.85);
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

  it('builds a dense reef shelf and distinct underwater resource silhouettes', () => {
    const materials = createTestMaterials();
    const reef = createReefModel(materials, 0x51ad7e);
    const terrain = reef.children[0] as Mesh;
    const types = ['sand', 'clay', 'metalOre', 'seaweed'] as const;
    const nodes = types.map((type) => createReefNodeModel(type, materials));
    expect(terrain.geometry.getAttribute('position').count).toBeGreaterThan(2_500);
    expect(reef.userData.reefVisuals.frondBatch.count).toBe(34);
    expect(reef.userData.reefVisuals.fishSchools).toHaveLength(3);
    expect(nodes.map(renderedPartCount).every((count) => count >= 7)).toBe(true);
    expect(nodes.every((node) => node.userData.reefNodeVisuals.highlight)).toBe(true);
  }, 15_000);

  it('builds detailed navigation equipment with deformable cloth and an anchor rig', () => {
    const materials = createTestMaterials();
    const sail = createSailModel(materials);
    const anchor = createAnchorModel(materials);
    const sailStats = meshStats(sail);
    const anchorStats = meshStats(anchor);
    const sailSize = new Box3().setFromObject(sail).getSize(new Vector3());
    expect(sailStats.meshes).toBeGreaterThanOrEqual(12);
    expect(sailStats.vertices).toBeGreaterThan(900);
    expect(sailSize.y).toBeGreaterThan(3.3);
    expect(sail.userData.navigationVisuals.clothBase.length).toBeGreaterThan(250);
    expect(anchorStats.meshes).toBeGreaterThanOrEqual(15);
    expect(anchor.userData.navigationVisuals.rope).toBeDefined();
  }, 15_000);

  it('builds a layered helm and visible sail reinforcement hardware', () => {
    const materials = createTestMaterials();
    const helm = createHelmModel(materials);
    const sail = createSailModel(materials);
    expect(meshStats(helm).meshes).toBeGreaterThanOrEqual(55);
    expect(helm.userData.navigationVisuals.wheel).toBeDefined();
    expect(helm.userData.navigationVisuals.routePins).toHaveLength(4);
    expect(helm.userData.navigationVisuals.gears).toHaveLength(3);
    expect(renderedPartCount(sail.userData.navigationVisuals.reinforcement)).toBeGreaterThanOrEqual(8);
  }, 15_000);

  it('builds dense original signal hardware with stateful scan and relay parts', () => {
    const materials = createTestMaterials();
    const receiver = createReceiverModel(materials);
    const antenna = createAntennaModel(materials);
    const beacon = createSignalBeaconModel(materials);
    expect(meshStats(receiver).meshes).toBeGreaterThanOrEqual(90);
    expect(meshStats(antenna).meshes).toBeGreaterThanOrEqual(50);
    expect(meshStats(beacon).meshes).toBeGreaterThanOrEqual(25);
    expect(receiver.userData.navigationVisuals.chargeBars).toHaveLength(6);
    expect(receiver.userData.navigationVisuals.blips).toHaveLength(3);
    expect(antenna.userData.navigationVisuals.mastPivots).toHaveLength(2);
    expect(antenna.userData.navigationVisuals.signalRings).toHaveLength(3);
    expect(beacon.userData.signalBeaconVisuals.pulseRings).toHaveLength(4);
    expect(new Box3().setFromObject(antenna).getSize(new Vector3()).y).toBeGreaterThan(1.9);
  }, 15_000);

  it('builds a staged crop planter and an articulated crop-thief bird', () => {
    const materials = createTestMaterials();
    const planter = createPlanterModel(materials);
    const bird = createSaltwingBirdModel(materials);
    const planterStats = meshStats(planter);
    const birdStats = meshStats(bird);
    const planterSize = new Box3().setFromObject(planter).getSize(new Vector3());
    const birdSize = new Box3().setFromObject(bird).getSize(new Vector3());
    expect(planterStats.meshes).toBeGreaterThanOrEqual(42);
    expect(planter.userData.planterVisuals.leafPivots).toHaveLength(9);
    expect(planter.userData.planterVisuals.fruits).toHaveLength(3);
    expect(planterSize.x).toBeGreaterThan(1);
    expect(birdStats.meshes).toBeGreaterThanOrEqual(28);
    expect(birdStats.vertices).toBeGreaterThan(700);
    expect(birdSize.x).toBeGreaterThan(1);
    expect(bird.userData.birdVisuals.leftWing).toBeDefined();
    expect(bird.userData.birdVisuals.feet).toBeDefined();
  }, 15_000);

  it('builds layered research, brick-drying and smelting equipment with stateful parts', () => {
    const materials = createTestMaterials();
    const research = createResearchBenchModel(materials);
    const drying = createDryingRackModel(materials);
    const smelter = createSmelterModel(materials);
    expect(meshStats(research).meshes).toBeGreaterThanOrEqual(30);
    expect(meshStats(drying).meshes).toBeGreaterThanOrEqual(9);
    expect(meshStats(smelter).meshes).toBeGreaterThanOrEqual(58);
    expect(drying.userData.dryingRackVisuals.bricks).toHaveLength(4);
    expect(research.userData.researchBenchVisuals.dial).toBeDefined();
    expect(smelter.userData.smelterVisuals.smoke).toHaveLength(6);
    expect(smelter.userData.smelterVisuals.sparks).toHaveLength(9);
    expect(smelter.userData.smelterVisuals.crucible).toBeDefined();
  }, 15_000);
});
