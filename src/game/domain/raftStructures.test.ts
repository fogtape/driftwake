import { describe, expect, it } from 'vitest';
import {
  canPlaceRaftStructure,
  canRemoveFoundationUnderStructures,
  canRemoveRaftStructure,
  pruneUnsupportedRaftStructures,
  sanitizeRaftStructures,
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
});
