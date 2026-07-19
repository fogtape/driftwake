import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  QuadraticBezierCurve3,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MaterialLibrary } from './Materials';

export interface CollectionNetModelVisuals {
  netBed: Group;
  cargoMarkers: Group[];
  wearRopes: Mesh[];
  fullMarker: Mesh;
}

function mesh(
  geometry: BoxGeometry | CylinderGeometry | RoundedBoxGeometry | SphereGeometry | TorusGeometry | TubeGeometry,
  material: MeshStandardMaterial,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
): Mesh {
  const result = new Mesh(geometry, material);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function mergeParts(parts: Mesh[], material: MeshStandardMaterial, name: string): Mesh {
  const transformed = parts.map((part) => {
    part.updateMatrix();
    const source = part.geometry.clone();
    const compatible = source.index ? source.toNonIndexed() : source;
    if (compatible !== source) source.dispose();
    return compatible.applyMatrix4(part.matrix);
  });
  const geometry = mergeGeometries(transformed, false) ?? new BufferGeometry();
  transformed.forEach((source) => source.dispose());
  const result = new Mesh(geometry, material);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function cargoMarker(
  index: number,
  materials: MaterialLibrary,
  blockGeometry: RoundedBoxGeometry,
  cylinderGeometry: CylinderGeometry,
): Group {
  const marker = new Group();
  const x = [-0.38, 0.18, -0.08, 0.4, -0.3, 0.13][index];
  const z = [-0.82, -0.94, -1.2, -1.17, -1.37, -1.43][index];
  marker.position.set(x, -0.015, z);
  marker.rotation.y = (index * 1.73) % Math.PI;
  marker.userData.baseY = marker.position.y;

  if (index === 0 || index === 3) {
    const timber = mesh(blockGeometry, materials.wood[index % materials.wood.length], [0, 0, 0]);
    timber.scale.set(index === 0 ? 0.34 : 0.27, 0.09, 0.1);
    timber.rotation.z = index === 0 ? 0.08 : -0.05;
    marker.add(timber);
  } else if (index === 1) {
    const polymer = mesh(blockGeometry, materials.polymer, [0, 0, 0]);
    polymer.scale.set(0.2, 0.06, 0.14);
    marker.add(polymer);
  } else if (index === 2 || index === 5) {
    const coil = mesh(new TorusGeometry(index === 2 ? 0.11 : 0.085, 0.025, 5, 12), materials.rope, [0, 0, 0], [Math.PI / 2, 0, 0]);
    marker.add(coil);
  } else {
    const barrel = mesh(cylinderGeometry, materials.darkWood, [0, 0, 0], [0, 0, Math.PI / 2]);
    barrel.scale.set(0.17, 0.18, 0.17);
    marker.add(barrel);
  }
  return marker;
}

export function createCollectionNetModel(materials: MaterialLibrary): Group {
  const root = new Group();
  root.name = 'tide-pocket-collection-net';

  const railGeometry = new RoundedBoxGeometry(1, 1, 1, 3, 0.08);
  const braceGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
  const pegGeometry = new CylinderGeometry(0.5, 0.5, 1, 8);
  const knotGeometry = new SphereGeometry(0.055, 7, 5);
  const floatGeometry = new CylinderGeometry(0.065, 0.08, 0.18, 9);
  const cargoBlockGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.09);
  const cargoCylinderGeometry = new CylinderGeometry(0.5, 0.5, 1, 8);

  const mountRail = mesh(railGeometry, materials.darkWood, [0, 0.005, -0.58]);
  mountRail.scale.set(1.25, 0.095, 0.09);
  const outerRail = mesh(railGeometry, materials.wood[1], [0, -0.025, -1.47]);
  outerRail.scale.set(1.22, 0.085, 0.105);
  const darkWoodParts = [mountRail];
  const metalParts: Mesh[] = [];
  const fixedRopeParts: Mesh[] = [];

  for (const side of [-1, 1]) {
    const arm = mesh(braceGeometry, materials.darkWood, [side * 0.56, -0.045, -1.02], [-0.105, 0, 0]);
    arm.scale.set(0.075, 0.075, 0.92);
    const clamp = mesh(braceGeometry, materials.rustMetal, [side * 0.53, 0.02, -0.49]);
    clamp.scale.set(0.13, 0.075, 0.16);
    const peg = mesh(pegGeometry, materials.rustMetal, [side * 0.53, 0.095, -0.49]);
    peg.scale.set(0.04, 0.055, 0.04);
    const sideLash = mesh(new TorusGeometry(0.075, 0.014, 5, 10), materials.rope, [side * 0.55, -0.01, -0.6], [Math.PI / 2, 0, 0]);
    darkWoodParts.push(arm);
    metalParts.push(clamp, peg);
    fixedRopeParts.push(sideLash);
  }
  root.add(
    mergeParts(darkWoodParts, materials.darkWood, 'collection-net-dark-wood-frame'),
    outerRail,
    mergeParts(metalParts, materials.rustMetal, 'collection-net-edge-clamps'),
    mergeParts(fixedRopeParts, materials.rope, 'collection-net-fixed-lashings'),
  );

  const netBed = new Group();
  netBed.name = 'collection-net-bed';
  const netParts: Mesh[] = [];
  const longitudinalX = [-0.5, -0.25, 0, 0.25, 0.5];
  for (const x of longitudinalX) {
    const curve = new QuadraticBezierCurve3(
      new Vector3(x, -0.055, -0.6),
      new Vector3(x * 0.96, -0.24 - Math.abs(x) * 0.035, -1.03),
      new Vector3(x, -0.035, -1.45),
    );
    netParts.push(mesh(new TubeGeometry(curve, 10, 0.012, 5, false), materials.rope, [0, 0, 0]));
  }
  for (let index = 0; index < 7; index += 1) {
    const t = index / 6;
    const z = MathUtils.lerp(-0.63, -1.43, t);
    const sag = -0.015 - Math.sin(t * Math.PI) * 0.18;
    const curve = new QuadraticBezierCurve3(
      new Vector3(-0.54, sag + 0.035, z),
      new Vector3(0, sag - 0.055, z - 0.015),
      new Vector3(0.54, sag + 0.035, z),
    );
    netParts.push(mesh(new TubeGeometry(curve, 8, 0.011, 5, false), materials.rope, [0, 0, 0]));
  }
  for (const x of [-0.5, 0, 0.5]) {
    for (const z of [-0.64, -1.04, -1.43]) {
      netParts.push(mesh(knotGeometry, materials.rope, [x, z === -1.04 ? -0.225 : -0.045, z]));
    }
  }
  netBed.add(mergeParts(netParts, materials.rope, 'collection-net-woven-bed'));
  root.add(netBed);

  const floatParts: Mesh[] = [];
  for (const x of [-0.43, 0, 0.43]) {
    const float = mesh(floatGeometry, materials.polymer, [x, -0.01, -1.5], [0, 0, Math.PI / 2]);
    float.scale.set(1, 1, 1);
    floatParts.push(float);
  }
  root.add(mergeParts(floatParts, materials.polymer, 'collection-net-floats'));

  const cargoMarkers = Array.from({ length: 6 }, (_, index) =>
    cargoMarker(index, materials, cargoBlockGeometry, cargoCylinderGeometry));
  cargoMarkers.forEach((marker) => {
    marker.visible = false;
    root.add(marker);
  });

  const wearRopes = [
    mesh(new TubeGeometry(new QuadraticBezierCurve3(
      new Vector3(-0.28, -0.12, -0.74),
      new Vector3(-0.17, -0.32, -0.87),
      new Vector3(-0.07, -0.22, -0.98),
    ), 7, 0.017, 5, false), materials.rope, [0, 0, 0]),
    mesh(new TubeGeometry(new QuadraticBezierCurve3(
      new Vector3(0.18, -0.25, -1.12),
      new Vector3(0.3, -0.39, -1.22),
      new Vector3(0.42, -0.2, -1.34),
    ), 7, 0.017, 5, false), materials.rope, [0, 0, 0]),
  ];
  wearRopes.forEach((rope) => {
    rope.visible = false;
    root.add(rope);
  });

  const fullMaterial = new MeshStandardMaterial({
    color: 0xd9bf63,
    emissive: 0x6d5313,
    emissiveIntensity: 0.7,
    roughness: 0.48,
  });
  const fullMarker = mesh(new SphereGeometry(0.055, 8, 6), fullMaterial, [0, 0.105, -1.51]);
  fullMarker.visible = false;
  root.add(fullMarker);

  root.userData.collectionNetVisuals = { netBed, cargoMarkers, wearRopes, fullMarker } satisfies CollectionNetModelVisuals;
  return root;
}

export function updateCollectionNetModel(
  visuals: CollectionNetModelVisuals,
  time: number,
  fillRatio: number,
  healthRatio: number,
): void {
  const fill = MathUtils.clamp(fillRatio, 0, 1);
  const health = MathUtils.clamp(healthRatio, 0, 1);
  visuals.netBed.position.y = Math.sin(time * 1.15) * 0.008 - fill * 0.035;
  const visibleCargo = Math.ceil(fill * visuals.cargoMarkers.length - 0.001);
  visuals.cargoMarkers.forEach((marker, index) => {
    marker.visible = index < visibleCargo;
    marker.position.y = marker.userData.baseY - fill * 0.035 + Math.sin(time * 1.5 + index * 1.3) * 0.006;
    marker.rotation.z = Math.sin(time * 0.72 + index) * 0.025;
  });
  visuals.wearRopes[0].visible = health < 0.7;
  visuals.wearRopes[1].visible = health < 0.42;
  visuals.fullMarker.visible = fill >= 0.999;
  if (visuals.fullMarker.material instanceof MeshStandardMaterial) {
    visuals.fullMarker.material.emissiveIntensity = fill >= 0.999 ? 0.62 + Math.sin(time * 4.4) * 0.18 : 0;
  }
}
