import {
  AdditiveBlending,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Material,
} from 'three';
import { createSeededRandom, randomRange } from '../math/random';
import {
  REEF_RADIUS_X,
  REEF_RADIUS_Z,
  sampleReefFloorHeight,
  type ReefNodeType,
} from '../domain/underwater';
import type { MaterialLibrary } from './Materials';

export interface ReefModelVisuals {
  caustics: Mesh<BufferGeometry, MeshBasicMaterial>;
  frondBatch: InstancedMesh;
  fronds: Group[];
  fishSchools: Group[];
  obstacles: Array<{ x: number; z: number; radius: number }>;
}

export interface ReefNodeVisuals {
  pivot: Group;
  highlight: Mesh;
  fronds: Group[];
}

function shadowed(mesh: Mesh): Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createReefTerrainGeometry(seed: number): BufferGeometry {
  const rings = 42;
  const sides = 80;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  positions.push(0, sampleReefFloorHeight(seed, 0, 0) ?? -0.72, 0);
  uvs.push(0.5, 0.5);
  for (let ring = 1; ring <= rings; ring += 1) {
    const radius = (ring / rings) * 2;
    for (let segment = 0; segment <= sides; segment += 1) {
      const angle = (segment / sides) * Math.PI * 2;
      const x = Math.cos(angle) * REEF_RADIUS_X * radius;
      const z = Math.sin(angle) * REEF_RADIUS_Z * radius;
      const sampledHeight = sampleReefFloorHeight(seed, x, z);
      const outerDepth = -6.1 - Math.max(0, radius - 1.06) * 3.3;
      positions.push(x, sampledHeight ?? outerDepth, z);
      uvs.push(x / (REEF_RADIUS_X * 2) + 0.5, z / (REEF_RADIUS_Z * 2) + 0.5);
    }
  }
  for (let segment = 0; segment < sides; segment += 1) {
    indices.push(0, 2 + segment, 1 + segment);
  }
  const stride = sides + 1;
  for (let ring = 1; ring < rings; ring += 1) {
    const innerStart = 1 + (ring - 1) * stride;
    const outerStart = innerStart + stride;
    for (let segment = 0; segment < sides; segment += 1) {
      const a = innerStart + segment;
      const b = innerStart + segment + 1;
      const c = outerStart + segment;
      const d = outerStart + segment + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createFrondGeometry(length: number, width: number, bend: number): BufferGeometry {
  const segments = 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const centerX = Math.sin(t * Math.PI * 0.78) * bend;
    const halfWidth = width * (1 - t * 0.72);
    positions.push(centerX - halfWidth, t * length, 0, centerX + halfWidth, t * length, 0);
    uvs.push(0, t, 1, t);
    if (index < segments) {
      const offset = index * 2;
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createInstancedBatch(geometry: BufferGeometry, material: Material, matrices: Matrix4[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addCoralBeds(
  reef: Group,
  materials: MaterialLibrary,
  seed: number,
  random: ReturnType<typeof createSeededRandom>,
): void {
  const branchMatrices: [Matrix4[], Matrix4[]] = [[], []];
  const budMatrices: [Matrix4[], Matrix4[]] = [[], []];
  const position = new Vector3();
  const scale = new Vector3();
  const quaternion = new Quaternion();
  const euler = new Euler();
  for (let clusterIndex = 0; clusterIndex < 18; clusterIndex += 1) {
    const materialIndex = clusterIndex % 3 !== 1 ? 0 : 1;
    const centerAngle = randomRange(random, 0, Math.PI * 2);
    const centerRadius = randomRange(random, 0.49, 0.91);
    const centerX = Math.cos(centerAngle) * REEF_RADIUS_X * centerRadius;
    const centerZ = Math.sin(centerAngle) * REEF_RADIUS_Z * centerRadius;
    const centerY = sampleReefFloorHeight(seed, centerX, centerZ) ?? -3;
    const clusterRotation = randomRange(random, -Math.PI, Math.PI);
    const clusterScale = randomRange(random, 0.72, 1.28);
    const branches = 4 + (clusterIndex % 3);
    for (let index = 0; index < branches; index += 1) {
      const height = 0.38 + ((index * 7 + clusterIndex) % 5) * 0.11;
      const angle = (index / branches) * Math.PI * 2 + clusterIndex * 0.31 + clusterRotation;
      position.set(
        centerX + Math.cos(angle) * 0.11 * clusterScale,
        centerY + height * 0.48 * clusterScale,
        centerZ + Math.sin(angle) * 0.11 * clusterScale,
      );
      quaternion.setFromEuler(euler.set(Math.sin(angle) * 0.22, clusterRotation, Math.cos(angle) * 0.28));
      scale.set(clusterScale, height * clusterScale, clusterScale);
      branchMatrices[materialIndex].push(new Matrix4().compose(position, quaternion, scale));
      if (index % 2 === 0) {
        position.set(
          centerX + Math.cos(angle) * 0.19 * clusterScale,
          centerY + height * 0.93 * clusterScale,
          centerZ + Math.sin(angle) * 0.19 * clusterScale,
        );
        scale.set(clusterScale, clusterScale * 0.72, clusterScale);
        budMatrices[materialIndex].push(new Matrix4().compose(position, quaternion.identity(), scale));
      }
    }
  }
  const branchGeometry = new CylinderGeometry(0.025, 0.07, 1, 7);
  const budGeometry = new SphereGeometry(0.075, 8, 6);
  reef.add(
    createInstancedBatch(branchGeometry, materials.coralWarm, branchMatrices[0]),
    createInstancedBatch(branchGeometry.clone(), materials.coralPale, branchMatrices[1]),
    createInstancedBatch(budGeometry, materials.coralWarm, budMatrices[0]),
    createInstancedBatch(budGeometry.clone(), materials.coralPale, budMatrices[1]),
  );
}

function createFishSchool(materials: MaterialLibrary): Group {
  const school = new Group();
  const bodies = new InstancedMesh(new SphereGeometry(0.14, 8, 6), materials.reefFish, 7);
  const tails = new InstancedMesh(new ConeGeometry(0.1, 0.19, 3), materials.reefFish, 7);
  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const euler = new Euler();
  for (let index = 0; index < 7; index += 1) {
    const size = 0.7 + (index % 3) * 0.12;
    const x = (index - 3) * 0.34;
    const y = Math.sin(index * 1.7) * 0.18;
    const z = (index % 3 - 1) * 0.32;
    position.set(x, y, z);
    quaternion.setFromEuler(euler.set(0, Math.PI / 2, 0));
    scale.set(1.7 * size, 0.72 * size, 0.48 * size);
    bodies.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    position.set(x, y, z + 0.27 * size);
    quaternion.setFromEuler(euler.set(Math.PI / 2, 0, Math.PI / 2));
    scale.setScalar(size);
    tails.setMatrixAt(index, matrix.compose(position, quaternion, scale));
  }
  bodies.instanceMatrix.needsUpdate = true;
  tails.instanceMatrix.needsUpdate = true;
  school.add(bodies, tails);
  return school;
}

export function createReefModel(materials: MaterialLibrary, seed: number): Group {
  const reef = new Group();
  reef.name = 'salt-crown-underwater-reef';
  const terrainGeometry = createReefTerrainGeometry(seed);
  const terrain = new Mesh(terrainGeometry, materials.reefSeabed);
  terrain.receiveShadow = true;
  reef.add(terrain);

  const caustics = new Mesh(terrainGeometry.clone(), materials.reefCaustic);
  const causticPositions = caustics.geometry.getAttribute('position');
  for (let index = 0; index < causticPositions.count; index += 1) {
    causticPositions.setY(index, causticPositions.getY(index) + 0.025);
  }
  causticPositions.needsUpdate = true;
  reef.add(caustics);

  const random = createSeededRandom((seed ^ 0x5eabed) >>> 0);
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  const rocks = new InstancedMesh(new DodecahedronGeometry(0.34, 0), materials.reefRock, 44);
  const obstacles: Array<{ x: number; z: number; radius: number }> = [];
  for (let index = 0; index < 44; index += 1) {
    const angle = randomRange(random, 0, Math.PI * 2);
    const radius = randomRange(random, 0.42, 0.98);
    const x = Math.cos(angle) * REEF_RADIUS_X * radius;
    const z = Math.sin(angle) * REEF_RADIUS_Z * radius;
    const size = randomRange(random, 0.52, 1.48);
    position.set(x, (sampleReefFloorHeight(seed, x, z) ?? -5) + size * 0.2, z);
    rotation.setFromAxisAngle(new Vector3(random(), 1, random()).normalize(), randomRange(random, 0, Math.PI * 2));
    scale.set(size * randomRange(random, 0.75, 1.3), size * randomRange(random, 0.55, 1.0), size);
    matrix.compose(position, rotation, scale);
    rocks.setMatrixAt(index, matrix);
    if (size > 1.08) obstacles.push({ x, z, radius: size * 0.34 });
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  reef.add(rocks);

  addCoralBeds(reef, materials, seed, random);

  const fronds: Group[] = [];
  const frondMatrices: Matrix4[] = [];
  const frondQuaternion = new Quaternion();
  for (let index = 0; index < 34; index += 1) {
    const angle = randomRange(random, 0, Math.PI * 2);
    const radius = randomRange(random, 0.42, 0.94);
    const x = Math.cos(angle) * REEF_RADIUS_X * radius;
    const z = Math.sin(angle) * REEF_RADIUS_Z * radius;
    position.set(x, sampleReefFloorHeight(seed, x, z) ?? -3, z);
    frondQuaternion.setFromAxisAngle(new Vector3(0, 1, 0), randomRange(random, -Math.PI, Math.PI));
    scale.set(randomRange(random, 0.72, 1.26), randomRange(random, 0.52, 1.18), randomRange(random, 0.72, 1.26));
    frondMatrices.push(new Matrix4().compose(position, frondQuaternion, scale));
  }
  const frondBatch = createInstancedBatch(createFrondGeometry(0.9, 0.08, 0.18), materials.seaweed, frondMatrices);
  reef.add(frondBatch);

  const fishSchools: Group[] = [];
  for (let schoolIndex = 0; schoolIndex < 3; schoolIndex += 1) {
    const school = createFishSchool(materials);
    school.userData.phase = randomRange(random, 0, Math.PI * 2);
    school.userData.radius = 5.8 + schoolIndex * 1.4;
    school.userData.height = -1.6 - schoolIndex * 0.68;
    fishSchools.push(school);
    reef.add(school);
  }

  reef.userData.reefVisuals = { caustics, frondBatch, fronds, fishSchools, obstacles } satisfies ReefModelVisuals;
  return reef;
}

function createHighlight(radius: number): Mesh {
  const material = new MeshBasicMaterial({
    color: 0xb9fff2,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const highlight = new Mesh(new TorusGeometry(radius, 0.018, 6, 36), material);
  highlight.rotation.x = Math.PI / 2;
  highlight.position.y = 0.035;
  highlight.visible = false;
  return highlight;
}

export function createReefNodeModel(type: ReefNodeType, materials: MaterialLibrary): Group {
  const node = new Group();
  node.name = `reef-resource-${type}`;
  const pivot = new Group();
  const fronds: Group[] = [];
  node.add(pivot);
  let radius = 0.48;

  if (type === 'seaweed') {
    radius = 0.46;
    const frondSway = new Group();
    const frondBatch = new InstancedMesh(createFrondGeometry(1, 0.075, 0.2), materials.seaweed, 7);
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const euler = new Euler();
    for (let index = 0; index < 7; index += 1) {
      const angle = (index / 7) * Math.PI * 2;
      position.set(Math.cos(angle) * 0.16, 0, Math.sin(angle) * 0.16);
      rotation.setFromEuler(euler.set(0, angle, (index % 2) * 0.08));
      scale.set(1, 0.72 + (index % 3) * 0.18, 1);
      frondBatch.setMatrixAt(index, matrix.compose(position, rotation, scale));
    }
    frondBatch.instanceMatrix.needsUpdate = true;
    frondSway.userData.phase = 0;
    frondSway.add(frondBatch);
    fronds.push(frondSway);
    pivot.add(frondSway);
    const holdfast = shadowed(new Mesh(new DodecahedronGeometry(0.18, 0), materials.reefRock));
    holdfast.scale.y = 0.44;
    holdfast.position.y = 0.06;
    pivot.add(holdfast);
  } else {
    const material = type === 'sand' ? materials.reefSeabed : type === 'clay' ? materials.clay : materials.reefRock;
    const lumps = new InstancedMesh(new DodecahedronGeometry(type === 'metalOre' ? 0.25 : 0.22, 0), material, 6);
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2 + (index % 2) * 0.3;
      position.set(Math.cos(angle) * 0.25, 0.09 + (index % 3) * 0.045, Math.sin(angle) * 0.21);
      rotation.setFromAxisAngle(new Vector3(0.3, 1, 0.2).normalize(), index * 0.78);
      const height = type === 'metalOre' ? 0.8 + (index % 2) * 0.35 : 0.42 + (index % 3) * 0.08;
      scale.set(0.9 + (index % 2) * 0.35, height, 0.82 + ((index + 1) % 3) * 0.16);
      matrix.compose(position, rotation, scale);
      lumps.setMatrixAt(index, matrix);
    }
    lumps.instanceMatrix.needsUpdate = true;
    lumps.castShadow = true;
    lumps.receiveShadow = true;
    pivot.add(lumps);
    if (type === 'metalOre') {
      radius = 0.54;
      const crystals = new InstancedMesh(new DodecahedronGeometry(0.09, 0), materials.ore, 7);
      for (let index = 0; index < 7; index += 1) {
        const angle = (index / 7) * Math.PI * 2;
        position.set(Math.cos(angle) * 0.23, 0.22 + (index % 3) * 0.08, Math.sin(angle) * 0.2);
        rotation.setFromAxisAngle(new Vector3(1, 0.4, 0.3).normalize(), index * 0.64);
        scale.set(0.75, 1.25 + (index % 2) * 0.55, 0.72);
        matrix.compose(position, rotation, scale);
        crystals.setMatrixAt(index, matrix);
      }
      crystals.instanceMatrix.needsUpdate = true;
      crystals.castShadow = true;
      pivot.add(crystals);
    }
  }

  const highlight = createHighlight(radius);
  node.add(highlight);
  node.userData.reefNodeVisuals = { pivot, highlight, fronds } satisfies ReefNodeVisuals;
  return node;
}
