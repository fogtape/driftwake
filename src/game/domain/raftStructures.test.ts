import { describe, expect, it } from 'vitest';
import {
  canPlaceRaftStructure,
  canRemoveFoundationUnderStructures,
  canRemoveRaftStructure,
  pruneUnsupportedRaftStructures,
  RAFT_STRUCTURE_LEVEL_HEIGHT,
  RAFT_STRUCTURE_DEFINITIONS,
  RAFT_TILE_X,
  RAFT_TILE_Z,
  raftStructureDamageStage,
  sampleRaftWalkableSurfaces,
  sanitizeRaftStructures,
  sanitizeRaftFootHeight,
  selectSharkAttackStructure,
  selectRaftLandingSurface,
  selectReachableRaftSurface,
  structurePlacementKey,
  type SavedRaftStructure,
} from './raftStructures';

const foundations = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
];

function structure(
  id: string,
  type: SavedRaftStructure['type'],
  x: number,
  z: number,
  level: number,
  rotation: SavedRaftStructure['rotation'] = 0,
): SavedRaftStructure {
  return { id, type, x, z, level, rotation, health: 100 };
}

describe('raft structure topology', () => {
  it('normalizes opposite wall anchors into one shared edge slot', () => {
    expect(structurePlacementKey(structure('north', 'wall', 0, 0, 0, 0))).toBe(
      structurePlacementKey(structure('south', 'door', 0, -1, 0, 2)),
    );
  });

  it('requires a bearing surface for vertical pieces and two supports for an upper floor', () => {
    const north = structure('north', 'wall', 0, 0, 0, 0);
    const east = structure('east', 'wall', 0, 0, 0, 1);
    const floor = structure('floor', 'floor', 0, 0, 1);
    expect(canPlaceRaftStructure([], foundations, north)).toBe('valid');
    expect(canPlaceRaftStructure([], foundations, structure('floating', 'wall', 4, 4, 0))).toBe('unsupported');
    expect(canPlaceRaftStructure([north], foundations, floor)).toBe('unsupported');
    expect(canPlaceRaftStructure([north, east], foundations, floor)).toBe('valid');
  });

  it('allows a stair landing to support one upper floor without a circular dependency', () => {
    const stairs = structure('stairs', 'stairs', 0, 0, 0, 1);
    const landing = structure('landing', 'floor', 1, 0, 1);
    expect(canPlaceRaftStructure([], foundations, stairs)).toBe('valid');
    expect(canPlaceRaftStructure([stairs], foundations, landing)).toBe('valid');
  });

  it('rejects duplicate edge and cell occupants', () => {
    const wall = structure('wall', 'wall', 0, 0, 0, 1);
    expect(canPlaceRaftStructure([wall], foundations, structure('door', 'door', 1, 0, 0, 3))).toBe('occupied');
    const pillar = structure('pillar', 'pillar', 0, 0, 0);
    expect(canPlaceRaftStructure([pillar], foundations, structure('stairs', 'stairs', 0, 0, 0))).toBe('occupied');
  });

  it('protects supports from dismantling and foundation removal', () => {
    const north = structure('north', 'wall', 0, 0, 0, 0);
    const east = structure('east', 'wall', 0, 0, 0, 1);
    const floor = structure('floor', 'floor', 0, 0, 1);
    const assembly = [north, east, floor];
    expect(canRemoveRaftStructure(assembly, foundations, 'north')).toBe(false);
    expect(canRemoveRaftStructure(assembly, foundations, 'floor')).toBe(true);
    expect(canRemoveFoundationUnderStructures(assembly, foundations, { x: 0, z: 0 })).toBe(false);
  });

  it('prunes dependent upper pieces after a supporting foundation is destroyed', () => {
    const pillar = structure('pillar', 'pillar', 0, 0, 0);
    const floor = structure('floor', 'floor', 0, 0, 1);
    const upperWall = structure('upper-wall', 'wall', 0, 0, 1, 0);
    const result = pruneUnsupportedRaftStructures([pillar, floor, upperWall], [{ x: 1, z: 0 }]);
    expect(result.kept).toEqual([]);
    expect(result.removed.map((entry) => entry.id)).toEqual(['pillar', 'floor', 'upper-wall']);
  });

  it('sanitizes unordered saved assemblies in dependency passes and drops malformed pieces', () => {
    const saved = sanitizeRaftStructures([
      structure('upper', 'wall', 0, 0, 1, 0),
      structure('floor', 'floor', 0, 0, 1),
      { ...structure('pillar', 'pillar', 0, 0, 0), health: 999 },
      structure('edge-wall', 'wall', 0, 0, 0, 0),
      structure('duplicate-edge', 'door', 0, 0, 0, 0),
      { id: 'bad', type: 'mast', x: 0, z: 0, level: 0, rotation: 0, health: 10 },
    ], foundations);
    expect(saved.map((entry) => entry.id)).toEqual(['pillar', 'edge-wall', 'floor', 'upper']);
    expect(saved.find((entry) => entry.id === 'pillar')?.health).toBe(125);
  });

  it('samples a continuous rotated stair ramp into its destination floor', () => {
    const stairs = structure('stairs', 'stairs', 0, 0, 0, 1);
    const floor = structure('floor', 'floor', 1, 0, 1);
    const bottom = sampleRaftWalkableSurfaces([stairs, floor], foundations, -RAFT_TILE_X * 0.5, 0);
    const middle = sampleRaftWalkableSurfaces([stairs, floor], foundations, 0, 0);
    const top = sampleRaftWalkableSurfaces([stairs, floor], foundations, RAFT_TILE_X * 0.5, 0);
    expect(bottom.find((surface) => surface.type === 'stairs')?.height).toBeCloseTo(0);
    expect(middle.find((surface) => surface.type === 'stairs')?.height).toBeCloseTo(RAFT_STRUCTURE_LEVEL_HEIGHT * 0.5);
    expect(top.find((surface) => surface.type === 'stairs')?.height).toBeCloseTo(RAFT_STRUCTURE_LEVEL_HEIGHT);
    expect(top.some((surface) => surface.type === 'floor')).toBe(true);
  });

  it('chooses only reachable layers and never lands through a floor above the player', () => {
    const stairs = structure('stairs', 'stairs', 0, 0, 0, 0);
    const floor = structure('floor', 'floor', 0, 0, 1);
    const underFloor = sampleRaftWalkableSurfaces([stairs, floor], foundations, -0.68, 0);
    expect(selectReachableRaftSurface(underFloor, 0)?.height).toBe(0);

    const stairBottom = sampleRaftWalkableSurfaces([stairs, floor], foundations, 0, RAFT_TILE_Z * 0.5 - 0.06);
    expect(selectReachableRaftSurface(stairBottom, 0)?.type).toBe('stairs');
    expect(selectRaftLandingSurface(underFloor, 0.8)?.height).toBe(0);
    expect(selectRaftLandingSurface(underFloor, 3)?.height).toBe(RAFT_STRUCTURE_LEVEL_HEIGHT);
  });

  it('samples a pitched roof and restores saved height to the nearest real surface', () => {
    const roof = structure('roof', 'roof', 0, 0, 1, 0);
    const edge = sampleRaftWalkableSurfaces([roof], foundations, RAFT_TILE_X * 0.5, 0);
    const ridge = sampleRaftWalkableSurfaces([roof], foundations, 0, 0);
    const edgeRoof = edge.find((surface) => surface.type === 'roof')!;
    const ridgeRoof = ridge.find((surface) => surface.type === 'roof')!;
    expect(ridgeRoof.height).toBeGreaterThan(edgeRoof.height + 0.2);
    expect(sanitizeRaftFootHeight(ridge, 2.4)).toBe(ridgeRoof.height);
    expect(sanitizeRaftFootHeight(ridge, -99)).toBe(0);
  });

  it('classifies visible damage stages and defines a bounded repair contract for every piece', () => {
    const wall = structure('wall', 'wall', 0, 0, 0);
    expect(raftStructureDamageStage(wall)).toBe('intact');
    expect(raftStructureDamageStage({ ...wall, health: 76 })).toBe('worn');
    expect(raftStructureDamageStage({ ...wall, health: 41 })).toBe('critical');
    for (const definition of Object.values(RAFT_STRUCTURE_DEFINITIONS)) {
      expect(definition.repairAmount).toBeGreaterThan(0);
      expect(Object.values(definition.repairCost).reduce((total, amount) => total + (amount ?? 0), 0)).toBeGreaterThan(0);
      expect(definition.repairAmount).toBeLessThan(definition.maxHealth);
    }
  });

  it('selects only exposed structures from the shark-facing perimeter', () => {
    const exposed = structure('exposed', 'wall', 1, 0, 0, 1);
    const opposite = structure('opposite', 'roof', -1, 0, 1);
    const interior = structure('interior', 'pillar', 0, 0, 0);
    expect(selectSharkAttackStructure(
      [opposite, interior, exposed],
      [{ x: -1, z: 0 }, { x: 1, z: 0 }],
      12,
      0,
    )?.id).toBe('exposed');
    expect(selectSharkAttackStructure([interior], [{ x: -1, z: 0 }, { x: 1, z: 0 }], 12, 0)).toBeNull();
    expect(selectSharkAttackStructure(
      [structure('upper-wall', 'wall', 1, 0, 1)],
      [{ x: 1, z: 0 }],
      12,
      0,
    )).toBeNull();

    for (const type of Object.keys(RAFT_STRUCTURE_DEFINITIONS) as SavedRaftStructure['type'][]) {
      const candidate = structure(`target-${type}`, type, 1, 0, type === 'floor' || type === 'roof' ? 1 : 0);
      expect(selectSharkAttackStructure([candidate], [{ x: 1, z: 0 }], 12, 0)?.type).toBe(type);
    }
  });
});
