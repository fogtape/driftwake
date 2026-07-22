import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { SalvageTarget } from './DebrisField';
import { selectSalvageFocus } from './SalvageSystem';

function target(
  source: SalvageTarget['source'],
  kind: SalvageTarget['kind'],
  position: Vector3,
): SalvageTarget {
  const model = new Group();
  model.position.copy(position);
  return {
    source,
    kind,
    model,
    loot: { timber: 1 },
    bobPhase: 0,
    driftSpeed: 0,
    spinSpeed: 0,
    active: true,
    latched: false,
  } as SalvageTarget;
}

describe('near-pickup salvage focus', () => {
  const camera = new Vector3(0, 1.5, 0);
  const forward = new Vector3(0, -0.6, -0.8).normalize();

  it('selects the nearest centered target and ignores inactive salvage', () => {
    const farther = target('drift', 'cache', new Vector3(0, 0.1, -2.5));
    const nearer = target('drift', 'timber', new Vector3(0, 0.15, -1.8));
    const inactive = target('drop', 'cache', new Vector3(0, 0.5, -0.8));
    inactive.active = false;
    expect(selectSalvageFocus([farther, nearer, inactive], camera, forward, new Vector3())).toBe(nearer);
  });

  it('keeps a recovered world drop focused when ordinary drift salvage crosses in front of it', () => {
    const recovered = target('drop', 'cache', new Vector3(0, 0.1, -2.5));
    const passing = target('drift', 'cache', new Vector3(0, 0.1, -1.7));
    expect(selectSalvageFocus([passing, recovered], camera, forward, new Vector3())).toBe(recovered);
  });

  it('gives recovered drops a bounded focus margin without extending ordinary cache reach', () => {
    const recovered = target('drop', 'cache', new Vector3(0, -1, -3.68));
    const ordinary = target('drift', 'cache', new Vector3(0, -1, -3.68));
    expect(selectSalvageFocus([recovered], camera, forward, new Vector3())).toBe(recovered);
    expect(selectSalvageFocus([ordinary], camera, forward, new Vector3())).toBeNull();
  });

  it('rejects targets behind, outside the focus cone, or beyond hand reach', () => {
    const behind = target('drop', 'cache', new Vector3(0, 0.1, 1));
    const offset = target('drop', 'cache', new Vector3(2, 0.1, -1.8));
    const distant = target('drift', 'timber', new Vector3(0, -0.8, -3.4));
    expect(selectSalvageFocus([behind, offset, distant], camera, forward, new Vector3())).toBeNull();
  });
});
