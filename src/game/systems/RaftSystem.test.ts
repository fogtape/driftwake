import { InstancedMesh, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createMaterialLibrary, disposeMaterialLibrary } from '../art/Materials';
import { RaftSystem } from './RaftSystem';

describe('RaftSystem underside readability', () => {
  it('uses rounded support beams with enough thickness to read as solid geometry', () => {
    const wood = new Texture();
    const foam = new Texture();
    const materials = createMaterialLibrary({ wood, foam });
    const raft = new RaftSystem(materials);
    const beams = raft.group.getObjectByName('raft-underbeams');

    expect(beams).toBeInstanceOf(InstancedMesh);
    if (!(beams instanceof InstancedMesh)) throw new Error('raft underside beams are missing');
    beams.geometry.computeBoundingBox();
    const bounds = beams.geometry.boundingBox;
    if (!bounds) throw new Error('raft underside beam bounds are missing');

    expect(bounds.max.y - bounds.min.y).toBeGreaterThanOrEqual(0.13);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThanOrEqual(0.12);
    expect(beams.count).toBe(18);

    raft.group.traverse((object) => {
      if (object instanceof InstancedMesh) object.geometry.dispose();
    });
    disposeMaterialLibrary(materials);
    wood.dispose();
    foam.dispose();
  });
});
