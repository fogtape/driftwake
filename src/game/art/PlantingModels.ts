import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { MaterialLibrary } from './Materials';

export interface PlanterModelVisuals {
  soil: Mesh;
  moisture: Mesh;
  crop: Group;
  stem: Group;
  leafPivots: Group[];
  leafMeshes: Mesh[];
  fruits: Mesh[];
  seedMarker: Group;
  highlight: Mesh;
}

export interface BirdModelVisuals {
  leftWing: Group;
  rightWing: Group;
  head: Group;
  tail: Group;
  feet: Group;
}

function shadowed<T extends Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createLeafGeometry(length: number, width: number): BufferGeometry {
  const segments = 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const taper = Math.sin(Math.PI * Math.pow(t, 0.82));
    const y = Math.sin(t * Math.PI) * 0.026;
    const z = t * length;
    positions.push(-width * taper * 0.5, y, z, width * taper * 0.5, y, z);
    uvs.push(0, t, 1, t);
    if (index < segments) {
      const base = index * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFeatherGeometry(length: number, width: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, 0.025, 0,
    -width * 0.5, 0, length * 0.42,
    0, -0.012, length,
    width * 0.5, 0, length * 0.42,
  ], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([0.5, 0, 0, 0.42, 0.5, 1, 1, 0.42], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function addBinding(group: Group, x: number, z: number, y: number, materials: MaterialLibrary): void {
  const binding = shadowed(new Mesh(new TorusGeometry(0.065, 0.011, 5, 12), materials.wovenFiber));
  binding.position.set(x, y, z);
  binding.rotation.x = Math.PI / 2;
  group.add(binding);
}

export function createPlanterModel(materials: MaterialLibrary): Group {
  const planter = new Group();
  planter.name = 'tide-bed-planter';

  const floor = shadowed(new Mesh(new BoxGeometry(0.92, 0.1, 0.72), materials.darkWood));
  floor.position.y = 0.16;
  planter.add(floor);

  for (let index = -2; index <= 2; index += 1) {
    const slat = shadowed(new Mesh(new BoxGeometry(0.18, 0.32, 0.075), materials.wood[(index + 5) % 3]));
    slat.position.set(index * 0.19, 0.34, 0.395);
    slat.rotation.z = index * 0.009;
    planter.add(slat);
    const back = slat.clone();
    back.position.z = -0.395;
    back.rotation.z *= -1;
    planter.add(back);
  }
  for (const x of [-0.5, 0.5]) {
    for (const z of [-0.27, -0.09, 0.09, 0.27]) {
      const slat = shadowed(new Mesh(new BoxGeometry(0.075, 0.32, 0.17), materials.wood[z > 0 ? 1 : 2]));
      slat.position.set(x, 0.34, z);
      planter.add(slat);
    }
  }

  for (const x of [-0.46, 0.46]) {
    for (const z of [-0.35, 0.35]) {
      const foot = shadowed(new Mesh(new CylinderGeometry(0.045, 0.065, 0.22, 7), materials.darkWood));
      foot.position.set(x, 0.02, z);
      planter.add(foot);
      addBinding(planter, x, z, 0.42, materials);
      const corner = shadowed(new Mesh(new BoxGeometry(0.085, 0.2, 0.025), materials.rustMetal));
      corner.position.set(x * 1.06, 0.33, z * 1.15);
      corner.rotation.y = x * z > 0 ? -0.7 : 0.7;
      planter.add(corner);
    }
  }

  const rimX = new BoxGeometry(1.08, 0.07, 0.08);
  const rimZ = new BoxGeometry(0.08, 0.07, 0.84);
  for (const z of [-0.41, 0.41]) {
    const rim = shadowed(new Mesh(rimX, materials.wood[z > 0 ? 1 : 0]));
    rim.position.set(0, 0.52, z);
    planter.add(rim);
  }
  for (const x of [-0.52, 0.52]) {
    const rim = shadowed(new Mesh(rimZ, materials.wood[x > 0 ? 2 : 1]));
    rim.position.set(x, 0.52, 0);
    planter.add(rim);
  }

  const soil = shadowed(new Mesh(new BoxGeometry(0.9, 0.17, 0.65, 5, 2, 4), materials.planterSoil));
  soil.position.y = 0.44;
  planter.add(soil);
  const moisture = new Mesh(
    new BoxGeometry(0.88, 0.012, 0.63),
    new MeshPhysicalMaterial({
      color: 0x29443a,
      roughness: 0.46,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  moisture.position.y = 0.532;
  planter.add(moisture);

  const drain = shadowed(new Mesh(new TorusGeometry(0.09, 0.017, 6, 18), materials.rustMetal));
  drain.position.set(0.51, 0.2, 0);
  drain.rotation.y = Math.PI / 2;
  planter.add(drain);

  const crop = new Group();
  crop.name = 'salt-crown-crop';
  crop.position.y = 0.52;
  const stem = new Group();
  const stemSegments = 4;
  for (let index = 0; index < stemSegments; index += 1) {
    const segment = shadowed(new Mesh(new CylinderGeometry(0.028 + index * 0.004, 0.04 + index * 0.006, 0.22, 7), materials.cropLeaf));
    segment.position.y = 0.09 + index * 0.16;
    segment.rotation.z = (index - 1.5) * 0.018;
    stem.add(segment);
  }
  crop.add(stem);

  const leafPivots: Group[] = [];
  const leafMeshes: Mesh[] = [];
  for (let index = 0; index < 9; index += 1) {
    const pivot = new Group();
    const tier = Math.floor(index / 3);
    pivot.position.y = 0.14 + tier * 0.2;
    pivot.rotation.y = index * 2.399;
    pivot.rotation.x = -0.22 - tier * 0.07;
    const leaf = shadowed(new Mesh(createLeafGeometry(0.34 + tier * 0.13, 0.12 + tier * 0.035), materials.cropLeaf));
    leaf.rotation.x = -0.16;
    pivot.add(leaf);
    leafPivots.push(pivot);
    leafMeshes.push(leaf);
    crop.add(pivot);
  }

  const fruits: Mesh[] = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2 + 0.4;
    const fruit = shadowed(new Mesh(new SphereGeometry(0.09, 9, 7), materials.cropFruit));
    fruit.scale.set(0.82, 1.12, 0.82);
    fruit.position.set(Math.cos(angle) * 0.12, 0.54 + (index % 2) * 0.04, Math.sin(angle) * 0.12);
    fruit.visible = false;
    fruits.push(fruit);
    crop.add(fruit);
  }

  const seedMarker = new Group();
  seedMarker.name = 'planted-seed-marker';
  const seed = shadowed(new Mesh(new SphereGeometry(0.055, 8, 6), materials.cropFruit));
  seed.scale.set(1, 0.58, 0.76);
  seed.rotation.z = 0.28;
  const seedFiber = shadowed(new Mesh(new TorusGeometry(0.052, 0.008, 5, 12, Math.PI * 1.4), materials.wovenFiber));
  seedFiber.rotation.x = Math.PI / 2;
  seedMarker.add(seed, seedFiber);
  seedMarker.position.set(0, 0.55, 0);
  seedMarker.visible = false;
  planter.add(crop, seedMarker);

  const highlight = new Mesh(
    new TorusGeometry(0.67, 0.018, 6, 42),
    new MeshBasicMaterial({ color: 0x83e0bc, transparent: true, opacity: 0.68, depthWrite: false }),
  );
  highlight.position.y = 0.08;
  highlight.rotation.x = Math.PI / 2;
  highlight.visible = false;
  planter.add(highlight);

  planter.userData.planterVisuals = {
    soil,
    moisture,
    crop,
    stem,
    leafPivots,
    leafMeshes,
    fruits,
    seedMarker,
    highlight,
  } satisfies PlanterModelVisuals;
  planter.userData.materialMaps = [
    materials.cropLeaf.map?.name ?? 'none',
    materials.cropLeaf.normalMap?.name ?? 'none',
    materials.cropLeaf.roughnessMap?.name ?? 'none',
    materials.cropDry.map?.name ?? 'none',
    materials.cropDry.normalMap?.name ?? 'none',
    materials.cropDry.roughnessMap?.name ?? 'none',
    materials.cropFruit.map?.name ?? 'none',
    materials.cropFruit.normalMap?.name ?? 'none',
    materials.cropFruit.roughnessMap?.name ?? 'none',
  ].join('|');
  return planter;
}

function createWing(materials: MaterialLibrary, side: -1 | 1): Group {
  const wing = new Group();
  wing.position.x = side * 0.21;
  wing.rotation.z = side * 0.16;
  for (let index = 0; index < 7; index += 1) {
    const feather = shadowed(new Mesh(createFeatherGeometry(0.54 - index * 0.035, 0.16 - index * 0.01), materials.birdWing));
    feather.position.set(side * index * 0.045, 0, index * 0.012);
    feather.rotation.y = side * (Math.PI / 2 + 0.12 + index * 0.055);
    feather.rotation.z = side * (-0.08 + index * 0.026);
    wing.add(feather);
  }
  return wing;
}

export function createSaltwingBirdModel(materials: MaterialLibrary): Group {
  const bird = new Group();
  bird.name = 'saltwing-crop-thief';

  const body = shadowed(new Mesh(new SphereGeometry(0.24, 12, 9), materials.birdFeather));
  body.scale.set(0.78, 0.8, 1.42);
  body.rotation.x = -0.08;
  bird.add(body);

  const chest = shadowed(new Mesh(new SphereGeometry(0.18, 10, 8), materials.birdFeather));
  chest.scale.set(0.92, 1.05, 0.76);
  chest.position.set(0, -0.01, 0.2);
  bird.add(chest);

  const head = new Group();
  head.position.set(0, 0.16, 0.3);
  const skull = shadowed(new Mesh(new SphereGeometry(0.135, 10, 8), materials.birdFeather));
  skull.scale.set(0.9, 0.94, 1.05);
  const beak = shadowed(new Mesh(new ConeGeometry(0.065, 0.24, 6), materials.birdBeak));
  beak.position.z = 0.18;
  beak.rotation.x = Math.PI / 2;
  head.add(skull, beak);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new CircleGeometry(0.026, 20), materials.birdEye);
    eye.name = `saltwing-eye-${side < 0 ? 'left' : 'right'}`;
    eye.position.set(side * 0.116, 0.025, 0.055);
    eye.rotation.y = side * Math.PI / 2;
    eye.renderOrder = 2;
    const eyeRim = shadowed(new Mesh(new TorusGeometry(0.028, 0.003, 5, 18), materials.birdWing));
    eyeRim.position.copy(eye.position);
    eyeRim.position.x += side * -0.001;
    eyeRim.rotation.copy(eye.rotation);
    head.add(eyeRim, eye);
    const brow = shadowed(new Mesh(createFeatherGeometry(0.11, 0.045), materials.birdWing));
    brow.position.set(side * 0.07, 0.105, -0.02);
    brow.rotation.set(-0.8, side * 0.16, side * 0.16);
    head.add(brow);
  }
  bird.add(head);

  const leftWing = createWing(materials, -1);
  const rightWing = createWing(materials, 1);
  bird.add(leftWing, rightWing);

  const tail = new Group();
  tail.position.z = -0.28;
  for (let index = -1; index <= 1; index += 1) {
    const feather = shadowed(new Mesh(createFeatherGeometry(0.38 - Math.abs(index) * 0.05, 0.13), materials.birdWing));
    feather.rotation.y = Math.PI + index * 0.18;
    feather.position.x = index * 0.07;
    tail.add(feather);
  }
  bird.add(tail);

  const feet = new Group();
  for (const side of [-1, 1]) {
    const leg = shadowed(new Mesh(new CylinderGeometry(0.012, 0.016, 0.16, 6), materials.birdBeak));
    leg.position.set(side * 0.075, -0.23, 0.03);
    const toes = new Group();
    toes.position.set(side * 0.075, -0.31, 0.1);
    for (let index = -1; index <= 1; index += 1) {
      const toe = shadowed(new Mesh(new CylinderGeometry(0.006, 0.009, 0.12, 5), materials.birdBeak));
      toe.rotation.x = Math.PI / 2 + index * 0.13;
      toe.position.x = index * 0.018;
      toes.add(toe);
    }
    feet.add(leg, toes);
  }
  feet.visible = false;
  bird.add(feet);

  bird.userData.birdVisuals = { leftWing, rightWing, head, tail, feet } satisfies BirdModelVisuals;
  bird.userData.materialMaps = [
    materials.birdFeather.map?.name ?? 'none',
    materials.birdFeather.normalMap?.name ?? 'none',
    materials.birdFeather.roughnessMap?.name ?? 'none',
    materials.birdWing.map?.name ?? 'none',
    materials.birdWing.normalMap?.name ?? 'none',
    materials.birdWing.roughnessMap?.name ?? 'none',
    materials.birdBeak.map?.name ?? 'none',
    materials.birdBeak.normalMap?.name ?? 'none',
    materials.birdBeak.roughnessMap?.name ?? 'none',
    materials.birdEye.map?.name ?? 'none',
    materials.birdEye.normalMap?.name ?? 'none',
    materials.birdEye.roughnessMap?.name ?? 'none',
  ].join('|');
  return bird;
}
