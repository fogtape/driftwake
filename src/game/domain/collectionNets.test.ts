import { describe, expect, it } from 'vitest';
import {
  COLLECTION_NET_CAPACITY,
  COLLECTION_NET_MAX_HEALTH,
  MAX_COLLECTION_NETS,
  canPlaceCollectionNet,
  captureIntoCollectionNet,
  collectionNetBlocksFoundationAt,
  collectionNetBlocksStructure,
  collectionNetOutsideCoordinate,
  collectionNetStoredUnits,
  sanitizeCollectionNets,
  type SavedCollectionNet,
} from './collectionNets';

function net(overrides: Partial<SavedCollectionNet> = {}): SavedCollectionNet {
  return {
    id: 'net-test',
    x: 0,
    z: 0,
    rotation: 0,
    health: COLLECTION_NET_MAX_HEALTH,
    storage: {},
    ...overrides,
  };
}

describe('collection nets', () => {
  it('maps all four mounting rotations to the adjacent water coordinate', () => {
    expect(collectionNetOutsideCoordinate(net({ rotation: 0 }))).toEqual({ x: 0, z: -1 });
    expect(collectionNetOutsideCoordinate(net({ rotation: 1 }))).toEqual({ x: 1, z: 0 });
    expect(collectionNetOutsideCoordinate(net({ rotation: 2 }))).toEqual({ x: 0, z: 1 });
    expect(collectionNetOutsideCoordinate(net({ rotation: 3 }))).toEqual({ x: -1, z: 0 });
  });

  it('only permits unique exposed edges on real foundations', () => {
    const foundations = [{ x: 0, z: 0 }, { x: 1, z: 0 }];
    expect(canPlaceCollectionNet([], foundations, net({ rotation: 0 }))).toEqual({ valid: true, reason: 'valid' });
    expect(canPlaceCollectionNet([], foundations, net({ rotation: 1 }))).toEqual({ valid: false, reason: 'not-edge' });
    expect(canPlaceCollectionNet([], foundations, net({ x: 4 }))).toEqual({ valid: false, reason: 'missing-host' });
    expect(canPlaceCollectionNet([net()], foundations, net())).toEqual({ valid: false, reason: 'occupied' });
  });

  it('reserves only the outside foundation coordinate occupied by the net bed', () => {
    const nets = [net({ x: 2, z: -1, rotation: 1 })];
    expect(collectionNetBlocksFoundationAt(nets, { x: 3, z: -1 })).toBe(true);
    expect(collectionNetBlocksFoundationAt(nets, { x: 2, z: -1 })).toBe(false);
    expect(collectionNetBlocksFoundationAt(nets, { x: 2, z: -2 })).toBe(false);
  });

  it('shares the base structure-edge key with walls and doors in both directions', () => {
    const nets = [net({ x: 0, z: 0, rotation: 0 })];
    expect(collectionNetBlocksStructure(nets, {
      type: 'wall', x: 0, z: 0, level: 0, rotation: 0,
    })).toBe(true);
    expect(collectionNetBlocksStructure(nets, {
      type: 'door', x: 0, z: 0, level: 1, rotation: 0,
    })).toBe(false);
    expect(canPlaceCollectionNet([], [{ x: 0, z: 0 }], net(), new Set(['edge:h:0:0:0']))).toEqual({
      valid: false,
      reason: 'occupied',
    });
  });

  it('caps passive captures by item units and preserves the rejected remainder', () => {
    const result = captureIntoCollectionNet(net({ storage: { timber: 10 } }), {
      polymer: 1,
      fiber: 3,
    });
    expect(result.accepted).toEqual({ polymer: 1, fiber: 1 });
    expect(result.rejected).toEqual({ fiber: 2 });
    expect(result.net.storage).toEqual({ timber: 10, polymer: 1, fiber: 1 });
    expect(collectionNetStoredUnits(result.net.storage)).toBe(COLLECTION_NET_CAPACITY);
  });

  it('sanitizes malformed state, duplicate edges, interior mounts and over-capacity storage', () => {
    const foundations = [{ x: 0, z: 0 }, { x: 1, z: 0 }];
    const saved = sanitizeCollectionNets([
      net({ id: 'kept', health: 999, storage: { timber: 20, polymer: 4 } }),
      net({ id: 'duplicate-edge' }),
      net({ id: 'interior', rotation: 1 }),
      net({ id: 'missing-host', x: 7 }),
      net({ id: 'invalid-rotation', rotation: 9 as never }),
    ], foundations);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: 'kept', health: COLLECTION_NET_MAX_HEALTH });
    expect(saved[0]?.storage).toEqual({ timber: COLLECTION_NET_CAPACITY });
  });

  it('enforces the runtime count ceiling', () => {
    const foundations = Array.from({ length: MAX_COLLECTION_NETS + 1 }, (_, x) => ({ x, z: 0 }));
    const nets = Array.from({ length: MAX_COLLECTION_NETS }, (_, x) => net({ id: `net-${x}`, x, rotation: 0 }));
    expect(canPlaceCollectionNet(nets, foundations, net({ x: MAX_COLLECTION_NETS, rotation: 0 }))).toEqual({
      valid: false,
      reason: 'limit',
    });
  });
});
