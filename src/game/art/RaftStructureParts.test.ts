import { describe, expect, it } from 'vitest';
import { createRaftStructureParts } from './RaftStructureParts';
import type { RaftStructureType } from '../domain/raftStructures';

describe('raft structure procedural assemblies', () => {
  it.each([
    ['floor', 12],
    ['wall', 18],
    ['door', 14],
    ['pillar', 9],
    ['stairs', 20],
    ['roof', 10],
  ] as [RaftStructureType, number][])('builds a detailed %s assembly', (type, minimumParts) => {
    const parts = createRaftStructureParts(type);
    expect(parts.length).toBeGreaterThanOrEqual(minimumParts);
    expect(parts.every((part) => part.scale.every((value) => Number.isFinite(value) && value > 0))).toBe(true);
  });

  it('swings only the door leaf while retaining the frame and part budget', () => {
    const closed = createRaftStructureParts('door', false);
    const open = createRaftStructureParts('door', true);
    expect(open).toHaveLength(closed.length);
    expect(open.slice(0, 6)).toEqual(closed.slice(0, 6));
    expect(open.slice(6).some((part, index) => part.position[2] !== closed[index + 6].position[2])).toBe(true);
  });

  it('uses a bounded shared geometry/material vocabulary suitable for instancing', () => {
    const buckets = new Set<string>();
    for (const type of ['floor', 'wall', 'door', 'pillar', 'stairs', 'roof'] as RaftStructureType[]) {
      for (const part of createRaftStructureParts(type, true)) buckets.add(`${part.geometry}:${part.material}`);
    }
    expect(buckets.size).toBeLessThanOrEqual(7);
  });
});
