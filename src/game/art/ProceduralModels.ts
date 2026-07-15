import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Quaternion,
  Euler,
  Float32BufferAttribute,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MaterialLibrary } from './Materials';

export type DebrisKind = 'timber' | 'polymer' | 'fiber' | 'cache';

function shadowed(mesh: Mesh): Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createHookModel(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = 'salvaged-hook';

  const handle = shadowed(new Mesh(new CylinderGeometry(0.07, 0.085, 0.62, 9), materials.darkWood));
  handle.position.y = 0.22;
  handle.rotation.z = -0.08;
  group.add(handle);

  const curve = new CatmullRomCurve3([
    new Vector3(0.0, 0.52, 0.0),
    new Vector3(0.0, 0.7, 0.0),
    new Vector3(0.09, 0.84, 0.0),
    new Vector3(0.25, 0.88, 0.0),
    new Vector3(0.39, 0.79, 0.0),
    new Vector3(0.43, 0.63, 0.0),
    new Vector3(0.35, 0.51, 0.0),
  ]);
  const hook = shadowed(new Mesh(new TubeGeometry(curve, 28, 0.036, 7, false), materials.rustMetal));
  group.add(hook);

  const tip = shadowed(new Mesh(new ConeGeometry(0.055, 0.2, 7), materials.metal));
  tip.position.set(0.32, 0.43, 0.0);
  tip.rotation.z = -0.46;
  group.add(tip);

  for (let index = 0; index < 5; index += 1) {
    const wrap = shadowed(new Mesh(new TorusGeometry(0.084, 0.013, 5, 14), materials.rope));
    wrap.position.y = 0.08 + index * 0.055;
    wrap.rotation.x = Math.PI / 2;
    wrap.rotation.z = 0.12 * index;
    group.add(wrap);
  }

  return group;
}

export function createHammerModel(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = 'salvaged-building-hammer';
  const handle = shadowed(new Mesh(new CylinderGeometry(0.065, 0.085, 0.9, 10), materials.darkWood));
  handle.rotation.z = -0.08;
  handle.position.y = 0.2;
  group.add(handle);

  const head = shadowed(new Mesh(new RoundedBoxGeometry(0.58, 0.22, 0.24, 4, 0.055), materials.metal));
  head.position.y = 0.69;
  head.rotation.z = -0.04;
  group.add(head);

  const strikingFace = shadowed(new Mesh(new CylinderGeometry(0.16, 0.13, 0.18, 10), materials.rustMetal));
  strikingFace.rotation.z = Math.PI / 2;
  strikingFace.position.set(-0.36, 0.69, 0);
  group.add(strikingFace);

  const claw = shadowed(new Mesh(new ConeGeometry(0.18, 0.36, 4), materials.rustMetal));
  claw.rotation.z = -Math.PI / 2;
  claw.position.set(0.42, 0.7, 0);
  group.add(claw);

  for (let index = 0; index < 6; index += 1) {
    const wrap = shadowed(new Mesh(new TorusGeometry(0.082, 0.012, 5, 14), materials.wovenFiber));
    wrap.position.y = -0.07 + index * 0.047;
    wrap.rotation.x = Math.PI / 2;
    wrap.rotation.z = index * 0.08;
    group.add(wrap);
  }
  return group;
}

export function createSpearModel(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = 'sharpened-wood-spear';
  const shaft = shadowed(new Mesh(new CylinderGeometry(0.028, 0.045, 2.45, 9), materials.darkWood));
  shaft.position.y = 0.4;
  group.add(shaft);
  const tip = shadowed(new Mesh(new ConeGeometry(0.085, 0.36, 7), materials.metal));
  tip.position.y = 1.8;
  group.add(tip);
  for (let index = 0; index < 5; index += 1) {
    const binding = shadowed(new Mesh(new TorusGeometry(0.052, 0.009, 5, 12), materials.wovenFiber));
    binding.position.y = 1.54 + index * 0.045;
    binding.rotation.x = Math.PI / 2;
    group.add(binding);
  }
  return group;
}

export function createFishingRodModel(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = 'fiber-fishing-rod';
  const rodCurve = new CatmullRomCurve3([
    new Vector3(0, -0.56, 0),
    new Vector3(0.01, 0.04, 0),
    new Vector3(0.02, 0.72, -0.015),
    new Vector3(0.04, 1.34, -0.05),
    new Vector3(0.08, 1.78, -0.12),
  ]);
  const rod = shadowed(new Mesh(new TubeGeometry(rodCurve, 30, 0.028, 7, false), materials.darkWood));
  group.add(rod);
  const grip = shadowed(new Mesh(new CylinderGeometry(0.055, 0.065, 0.56, 9), materials.wovenFiber));
  grip.position.y = -0.26;
  group.add(grip);
  const reel = shadowed(new Mesh(new TorusGeometry(0.14, 0.028, 7, 18), materials.rustMetal));
  reel.position.set(0.12, 0.02, 0);
  reel.rotation.y = Math.PI / 2;
  group.add(reel);
  const reelHub = shadowed(new Mesh(new CylinderGeometry(0.045, 0.045, 0.16, 9), materials.metal));
  reelHub.position.copy(reel.position);
  reelHub.rotation.z = Math.PI / 2;
  group.add(reelHub);
  return group;
}

export function createFishingBobber(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = 'fishing-bobber';
  const cream = new MeshStandardMaterial({ color: 0xe9dfbd, roughness: 0.72 });
  const coral = new MeshStandardMaterial({ color: 0xd96652, roughness: 0.68 });
  const body = shadowed(new Mesh(new SphereGeometry(0.115, 14, 10), cream));
  body.scale.y = 1.22;
  const cap = shadowed(new Mesh(new CylinderGeometry(0.055, 0.075, 0.13, 10), coral));
  cap.position.y = 0.13;
  const eye = shadowed(new Mesh(new TorusGeometry(0.026, 0.007, 5, 12), materials.metal));
  eye.position.y = 0.23;
  eye.rotation.x = Math.PI / 2;
  group.add(body, cap, eye);
  return group;
}

export function createSilverSpineFishModel(materials: MaterialLibrary): Group {
  const fish = new Group();
  fish.name = 'silver-spine-fish';
  const profile = [
    new Vector2(0.025, -0.72),
    new Vector2(0.2, -0.58),
    new Vector2(0.3, -0.18),
    new Vector2(0.27, 0.28),
    new Vector2(0.12, 0.58),
    new Vector2(0.045, 0.72),
  ];
  const bodyGeometry = new LatheGeometry(profile, 18);
  bodyGeometry.rotateX(Math.PI / 2);
  const bodyMaterial = materials.metal.clone();
  bodyMaterial.color.set(0x8eb9bb);
  bodyMaterial.metalness = 0.12;
  bodyMaterial.roughness = 0.46;
  const body = shadowed(new Mesh(bodyGeometry, bodyMaterial));
  body.scale.y = 0.68;
  fish.add(body);
  const tail = shadowed(
    new Mesh(
      createWedgeGeometry(
        [
          -0.03, 0, 0.58, -0.03, 0.34, 0.92, -0.03, 0, 0.82, -0.03, -0.34, 0.92,
          0.03, 0, 0.58, 0.03, 0.34, 0.92, 0.03, 0, 0.82, 0.03, -0.34, 0.92,
        ],
        [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 6, 7, 3, 2, 6],
      ),
      materials.polymer,
    ),
  );
  fish.add(tail);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.035, 9, 7), materials.sharkEye);
    eye.position.set(side * 0.2, 0.06, -0.5);
    fish.add(eye);
  }
  fish.scale.setScalar(0.72);
  return fish;
}

function createWedgeGeometry(vertices: readonly number[], indices: readonly number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex([...indices]);
  geometry.computeVertexNormals();
  return geometry;
}

function createSharkFins(materials: MaterialLibrary): Group {
  const fins = new Group();
  const dorsal = shadowed(
    new Mesh(
      createWedgeGeometry(
        [
          -0.045, 0.36, 0.55, -0.045, 0.34, -0.55, -0.045, 1.08, 0.18,
          0.045, 0.36, 0.55, 0.045, 0.34, -0.55, 0.045, 1.08, 0.18,
        ],
        [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0],
      ),
      materials.sharkSkin,
    ),
  );
  fins.add(dorsal);

  const leftPectoral = shadowed(
    new Mesh(
      createWedgeGeometry(
        [
          0.38, -0.08, -0.62, 0.54, -0.18, 0.46, 1.48, -0.42, 0.72,
          0.38, -0.03, -0.62, 0.54, -0.11, 0.46, 1.48, -0.35, 0.72,
        ],
        [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0],
      ),
      materials.sharkSkin,
    ),
  );
  const rightPectoral = leftPectoral.clone();
  rightPectoral.scale.x = -1;
  fins.add(leftPectoral, rightPectoral);
  return fins;
}

export function createSharkModel(materials: MaterialLibrary): Group {
  const shark = new Group();
  shark.name = 'graywake-shark';
  const profile = [
    new Vector2(0.05, -2.05),
    new Vector2(0.34, -1.92),
    new Vector2(0.56, -1.55),
    new Vector2(0.69, -0.75),
    new Vector2(0.66, 0.12),
    new Vector2(0.52, 0.92),
    new Vector2(0.28, 1.5),
    new Vector2(0.11, 1.82),
  ];
  const bodyGeometry = new LatheGeometry(profile, 28);
  bodyGeometry.rotateX(Math.PI / 2);
  const body = shadowed(new Mesh(bodyGeometry, materials.sharkSkin));
  body.scale.y = 0.84;
  shark.add(body, createSharkFins(materials));

  const tailPivot = new Group();
  tailPivot.name = 'shark-tail-pivot';
  tailPivot.position.z = 1.72;
  const peduncle = shadowed(new Mesh(new CylinderGeometry(0.08, 0.16, 0.72, 12), materials.sharkSkin));
  peduncle.rotation.x = Math.PI / 2;
  peduncle.position.z = 0.25;
  const tail = shadowed(
    new Mesh(
      createWedgeGeometry(
        [
          -0.05, 0, 0.45, -0.04, 1.04, 0.88, -0.03, 0.22, 0.98,
          0.05, 0, 0.45, 0.04, 1.04, 0.88, 0.03, 0.22, 0.98,
          -0.04, -0.94, 0.85, -0.03, -0.18, 1.02,
          0.04, -0.94, 0.85, 0.03, -0.18, 1.02,
        ],
        [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 6, 7, 0, 8, 3, 9, 6, 8, 9, 6, 9, 7],
      ),
      materials.sharkSkin,
    ),
  );
  tailPivot.add(peduncle, tail);
  shark.add(tailPivot);

  const eyeGeometry = new SphereGeometry(0.065, 12, 8);
  for (const side of [-1, 1]) {
    const eye = shadowed(new Mesh(eyeGeometry, materials.sharkEye));
    eye.position.set(side * 0.48, 0.16, -1.55);
    shark.add(eye);
  }

  const mouth = shadowed(new Mesh(new TorusGeometry(0.29, 0.025, 6, 22, Math.PI * 1.08), materials.sharkMouth));
  mouth.position.set(0, -0.25, -1.83);
  mouth.rotation.set(Math.PI / 2, 0, Math.PI * 0.04);
  mouth.scale.x = 1.35;
  shark.add(mouth);

  const gillGeometry = new BoxGeometry(0.018, 0.22, 0.025);
  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index += 1) {
      const gill = new Mesh(gillGeometry, materials.sharkMouth);
      gill.position.set(side * 0.59, -0.02, -0.96 + index * 0.13);
      gill.rotation.z = side * 0.15;
      shark.add(gill);
    }
  }

  shark.userData.tailPivot = tailPivot;
  shark.userData.body = body;
  shark.scale.setScalar(0.88);
  return shark;
}

function createPalmLeaf(material: MeshStandardMaterial, scale = 1): Mesh {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.22, 0.08, 0.42, 0.12, 0.74, 0.02);
  shape.bezierCurveTo(0.46, -0.09, 0.2, -0.07, 0, 0);
  const geometry = new ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
  const mesh = new Mesh(geometry, material);
  mesh.scale.setScalar(scale);
  return shadowed(mesh);
}

function createTimberDebris(materials: MaterialLibrary): Group {
  const group = new Group();
  const plank = shadowed(new Mesh(new RoundedBoxGeometry(1.55, 0.14, 0.32, 3, 0.045), materials.wood[1]));
  plank.rotation.y = 0.08;
  group.add(plank);
  const rope = shadowed(new Mesh(new TorusGeometry(0.18, 0.018, 5, 16), materials.rope));
  rope.position.x = -0.43;
  rope.rotation.y = Math.PI / 2;
  group.add(rope);
  return group;
}

function createPolymerDebris(materials: MaterialLibrary): Group {
  const group = new Group();
  const body = shadowed(new Mesh(new RoundedBoxGeometry(0.42, 0.52, 0.22, 4, 0.08), materials.polymer));
  body.rotation.z = 0.12;
  group.add(body);
  const neck = shadowed(new Mesh(new CylinderGeometry(0.07, 0.08, 0.12, 8), materials.polymer));
  neck.position.y = 0.31;
  const capMaterial = new MeshStandardMaterial({ color: 0xe2b95b, roughness: 0.74 });
  const cap = shadowed(new Mesh(new CylinderGeometry(0.078, 0.078, 0.065, 10), capMaterial));
  cap.position.y = 0.4;
  group.add(neck, cap);
  return group;
}

function createFiberDebris(materials: MaterialLibrary): Group {
  const group = new Group();
  for (let index = 0; index < 4; index += 1) {
    const leaf = createPalmLeaf(materials.leaf, 0.78 + index * 0.06);
    leaf.rotation.y = index * 1.55 + 0.3;
    leaf.rotation.x = -Math.PI / 2 + (index % 2) * 0.16;
    leaf.position.y = index * 0.012;
    group.add(leaf);
  }
  return group;
}

function createCacheDebris(materials: MaterialLibrary): Group {
  const group = new Group();
  const crate = shadowed(new Mesh(new RoundedBoxGeometry(0.72, 0.56, 0.72, 3, 0.035), materials.wood[0]));
  group.add(crate);
  const bandGeometry = new BoxGeometry(0.78, 0.07, 0.08);
  for (const z of [-0.24, 0.24]) {
    const band = shadowed(new Mesh(bandGeometry, materials.rustMetal));
    band.position.z = z;
    band.position.y = 0.03;
    group.add(band);
  }
  return group;
}

export function createDebrisModel(kind: DebrisKind, materials: MaterialLibrary): Group {
  const model =
    kind === 'timber'
      ? createTimberDebris(materials)
      : kind === 'polymer'
        ? createPolymerDebris(materials)
        : kind === 'fiber'
          ? createFiberDebris(materials)
          : createCacheDebris(materials);
  model.userData.kind = kind;
  return model;
}

export function createRaftTile(materials: MaterialLibrary, variant: number): Group {
  const tile = new Group();
  const plankMaterial = materials.wood[variant % materials.wood.length];
  for (let index = 0; index < 3; index += 1) {
    const plank = shadowed(new Mesh(new RoundedBoxGeometry(1.36, 0.16, 0.42, 3, 0.035), plankMaterial));
    plank.position.set(0, Math.sin(index * 2.1 + variant) * 0.014, (index - 1) * 0.45);
    plank.rotation.y = Math.sin(index * 3.7 + variant) * 0.018;
    tile.add(plank);
  }

  for (const z of [-0.46, 0.46]) {
    const beam = shadowed(new Mesh(new BoxGeometry(1.45, 0.1, 0.085), materials.darkWood));
    beam.position.set(0, -0.12, z);
    tile.add(beam);
  }

  const nailGeometry = new CylinderGeometry(0.025, 0.03, 0.02, 7);
  for (const x of [-0.52, 0.52]) {
    for (const z of [-0.46, 0.46]) {
      const nail = shadowed(new Mesh(nailGeometry, materials.rustMetal));
      nail.position.set(x, 0.09, z);
      tile.add(nail);
    }
  }
  return tile;
}

function createPalm(materials: MaterialLibrary): Group {
  const palm = new Group();
  const trunk = shadowed(new Mesh(new CylinderGeometry(0.12, 0.19, 2.8, 7), materials.darkWood));
  trunk.rotation.z = 0.09;
  trunk.position.y = 1.3;
  palm.add(trunk);
  for (let index = 0; index < 7; index += 1) {
    const leaf = createPalmLeaf(materials.foliage, 1.35);
    leaf.position.y = 2.72;
    leaf.rotation.y = (index / 7) * Math.PI * 2;
    leaf.rotation.x = -0.42;
    palm.add(leaf);
  }
  return palm;
}

export function createDistantIsland(materials: MaterialLibrary): Group {
  const island = new Group();
  island.name = 'distant-island';
  const rockGeometry = new DodecahedronGeometry(1, 1);
  const rocks = new InstancedMesh(rockGeometry, materials.rock, 3);
  const rockSpecs = [
    [-2.7, 0.0, 0.4, 3.3, 1.4, 2.4],
    [-0.4, 0.35, 0.1, 4.2, 2.0, 3.2],
    [2.8, 0.05, -0.3, 3.0, 1.5, 2.2],
  ] as const;
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const euler = new Euler();
  rockSpecs.forEach(([x, y, z, sx, sy, sz], index) => {
    position.set(x, y, z);
    scale.set(sx, sy, sz);
    rotation.setFromEuler(euler.set(0.1, x * 0.3, 0.04));
    matrix.compose(position, rotation, scale);
    rocks.setMatrixAt(index, matrix);
  });
  rocks.instanceMatrix.needsUpdate = true;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  island.add(rocks);

  const trunkGeometry = new CylinderGeometry(0.12, 0.19, 2.8, 7);
  const leafGeometry = createPalmLeaf(materials.foliage).geometry;
  const trunks = new InstancedMesh(trunkGeometry, materials.darkWood, 6);
  const leaves = new InstancedMesh(leafGeometry, materials.foliage, 42);
  let leafIndex = 0;
  const parentMatrix = new Matrix4();
  const localMatrix = new Matrix4();
  const palmPosition = new Vector3();
  const palmScale = new Vector3();
  const palmRotation = new Quaternion();
  const localRotation = new Quaternion();

  for (let index = 0; index < 6; index += 1) {
    const scalar = 0.72 + (index % 3) * 0.12;
    palmPosition.set(-2.6 + index * 1.05, 1.0 + Math.sin(index) * 0.2, -0.5 + (index % 2) * 0.8);
    palmScale.setScalar(scalar);
    palmRotation.setFromEuler(euler.set(0, index * 0.9, 0));
    parentMatrix.compose(palmPosition, palmRotation, palmScale);

    position.set(0, 1.3, 0);
    rotation.setFromEuler(euler.set(0, 0, 0.09));
    scale.set(1, 1, 1);
    localMatrix.compose(position, rotation, scale);
    matrix.multiplyMatrices(parentMatrix, localMatrix);
    trunks.setMatrixAt(index, matrix);

    for (let leaf = 0; leaf < 7; leaf += 1) {
      position.set(0, 2.72, 0);
      localRotation.setFromEuler(euler.set(-0.42, (leaf / 7) * Math.PI * 2, 0, 'YXZ'));
      scale.setScalar(1.35);
      localMatrix.compose(position, localRotation, scale);
      matrix.multiplyMatrices(parentMatrix, localMatrix);
      leaves.setMatrixAt(leafIndex, matrix);
      leafIndex += 1;
    }
  }
  for (const mesh of [trunks, leaves]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    island.add(mesh);
  }

  const sand = new Mesh(
    new CylinderGeometry(4.5, 5.6, 0.35, 18),
    new MeshStandardMaterial({ color: 0xd2bd87, roughness: 0.98, flatShading: true }),
  );
  sand.position.y = -0.75;
  sand.scale.z = 0.62;
  island.add(shadowed(sand));

  const beacon = new Mesh(new SphereGeometry(0.05), new MeshBasicMaterial({ color: 0xffe7b0 }));
  beacon.position.set(0, 3.0, 0);
  beacon.visible = false;
  island.add(beacon);
  return island;
}

export function createSplashMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: 0xe8ffff, transparent: true, opacity: 0.82, side: DoubleSide });
}

export function varyModel(model: Group, seed: number): void {
  model.rotation.set(
    MathUtils.degToRad((seed * 19) % 8 - 4),
    MathUtils.degToRad((seed * 47) % 360),
    MathUtils.degToRad((seed * 31) % 12 - 6),
  );
}
