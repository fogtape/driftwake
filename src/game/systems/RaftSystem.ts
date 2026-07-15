import {
  BoxGeometry,
  CylinderGeometry,
  Euler,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MaterialLibrary } from '../art/Materials';
import { sampleWave } from '../math/waves';

export class RaftSystem {
  readonly group = new Group();
  readonly halfExtent = 2.08;
  private readonly targetQuaternion = new Quaternion();
  private readonly targetEuler = new Euler();

  constructor(materials: MaterialLibrary) {
    this.group.name = 'player-raft';
    this.buildInstancedDeck(materials);
  }

  update(time: number, delta: number): void {
    const wave = sampleWave(this.group.position.x, this.group.position.z, time);
    const targetY = wave.height + 0.08;
    this.group.position.y = MathUtils.damp(this.group.position.y, targetY, 5.8, delta);

    this.targetEuler.set(wave.slopeZ * 0.33, 0, -wave.slopeX * 0.32, 'YXZ');
    this.targetQuaternion.setFromEuler(this.targetEuler);
    this.group.quaternion.slerp(this.targetQuaternion, 1 - Math.exp(-delta * 3.4));
  }

  localPointToWorld(point: Vector3, target = new Vector3()): Vector3 {
    return target.copy(point).applyQuaternion(this.group.quaternion).add(this.group.position);
  }

  clampLocalPosition(position: Vector3): void {
    position.x = MathUtils.clamp(position.x, -this.halfExtent + 0.24, this.halfExtent - 0.24);
    position.z = MathUtils.clamp(position.z, -this.halfExtent + 0.24, this.halfExtent - 0.24);
  }

  private buildInstancedDeck(materials: MaterialLibrary): void {
    const plankGeometry = new RoundedBoxGeometry(1.36, 0.16, 0.42, 3, 0.035);
    const beamGeometry = new BoxGeometry(1.45, 0.1, 0.085);
    const nailGeometry = new CylinderGeometry(0.025, 0.03, 0.02, 7);
    const plankMeshes = materials.wood.map((material) => new InstancedMesh(plankGeometry, material, 9));
    const beams = new InstancedMesh(beamGeometry, materials.darkWood, 18);
    const nails = new InstancedMesh(nailGeometry, materials.rustMetal, 36);
    const plankCounts = [0, 0, 0];
    let beamCount = 0;
    let nailCount = 0;
    let variant = 0;
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3(1, 1, 1);
    const euler = new Euler();

    for (let tileX = -1; tileX <= 1; tileX += 1) {
      for (let tileZ = -1; tileZ <= 1; tileZ += 1) {
        const materialIndex = variant % plankMeshes.length;
        const tileRotation = Math.sin(variant * 2.41) * 0.012;
        for (let index = 0; index < 3; index += 1) {
          position.set(
            tileX * 1.44,
            Math.sin(index * 2.1 + variant) * 0.014,
            tileZ * 1.38 + (index - 1) * 0.45,
          );
          euler.set(0, tileRotation + Math.sin(index * 3.7 + variant) * 0.018, 0);
          rotation.setFromEuler(euler);
          matrix.compose(position, rotation, scale);
          plankMeshes[materialIndex].setMatrixAt(plankCounts[materialIndex], matrix);
          plankCounts[materialIndex] += 1;
        }

        for (const offsetZ of [-0.46, 0.46]) {
          position.set(tileX * 1.44, -0.12, tileZ * 1.38 + offsetZ);
          euler.set(0, tileRotation, 0);
          rotation.setFromEuler(euler);
          matrix.compose(position, rotation, scale);
          beams.setMatrixAt(beamCount, matrix);
          beamCount += 1;
        }

        for (const offsetX of [-0.52, 0.52]) {
          for (const offsetZ of [-0.46, 0.46]) {
            position.set(tileX * 1.44 + offsetX, 0.09, tileZ * 1.38 + offsetZ);
            euler.set(0, tileRotation, 0);
            rotation.setFromEuler(euler);
            matrix.compose(position, rotation, scale);
            nails.setMatrixAt(nailCount, matrix);
            nailCount += 1;
          }
        }
        variant += 1;
      }
    }

    for (const mesh of [...plankMeshes, beams, nails]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }
}
