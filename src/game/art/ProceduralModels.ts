import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
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
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PointLight,
  PlaneGeometry,
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
import {
  ISLAND_RADIUS_X,
  ISLAND_RADIUS_Z,
  sampleIslandHeight,
  type HarvestNodeType,
} from '../domain/island';
import type { MaterialLibrary } from './Materials';

export type DebrisKind = 'timber' | 'polymer' | 'fiber' | 'barrel' | 'cache';

export interface DeviceModelVisuals {
  fire?: Group;
  light?: PointLight;
  puffs?: Mesh[];
  embers?: Mesh[];
  rawWater?: Mesh;
  cleanWater?: Mesh;
  drip?: Mesh;
  food?: Group;
  foodMeshes?: Mesh<BufferGeometry, MeshStandardMaterial>[];
  collectorPivot?: Group;
  waterCells?: Mesh[];
  waterReadyMarkers?: Mesh[];
  foodSlots?: Group[];
  foodSlotMeshes?: Mesh<BufferGeometry, MeshStandardMaterial>[][];
  fuelBars?: Mesh[];
  lid?: Group;
  storageMarkers?: Mesh[];
}

export interface IslandModelVisuals {
  foam: Mesh[];
  obstacles: Array<{ x: number; z: number; radius: number }>;
}

export interface HarvestModelVisuals {
  pivot: Group;
  stump: Mesh | null;
  highlight: Mesh;
}

export interface ResonanceForkVisuals {
  core: Mesh<BufferGeometry, MeshStandardMaterial>;
  chargeRings: Mesh<BufferGeometry, MeshBasicMaterial>[];
  tinePivots: Group[];
  triggerPivot: Group;
  light: PointLight;
}

function shadowed<T extends Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function isLibraryMaterial(material: MeshStandardMaterial, materials: MaterialLibrary): boolean {
  return (
    materials.wood.some((candidate) => candidate === material) ||
    Object.values(materials).some((candidate) => candidate === material)
  );
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

export function createSpearModel(materials: MaterialLibrary, upgraded = false): Group {
  const group = new Group();
  group.name = upgraded ? 'tide-cast-wave-piercer' : 'sharpened-wood-spear';
  const shaft = shadowed(new Mesh(new CylinderGeometry(0.028, 0.045, 2.45, 9), materials.darkWood));
  shaft.position.y = 0.4;
  group.add(shaft);
  const tip = shadowed(new Mesh(new ConeGeometry(upgraded ? 0.115 : 0.085, upgraded ? 0.54 : 0.36, upgraded ? 9 : 7), upgraded ? materials.metal : materials.rustMetal));
  tip.position.y = upgraded ? 1.88 : 1.8;
  group.add(tip);
  if (upgraded) {
    const collar = shadowed(new Mesh(new CylinderGeometry(0.075, 0.055, 0.23, 9), materials.metal));
    collar.position.y = 1.57;
    const crossPin = shadowed(new Mesh(new CylinderGeometry(0.024, 0.024, 0.28, 7), materials.rustMetal));
    crossPin.position.y = 1.53;
    crossPin.rotation.z = Math.PI / 2;
    group.add(collar, crossPin);
  }
  for (let index = 0; index < 5; index += 1) {
    const binding = shadowed(new Mesh(new TorusGeometry(0.052, 0.009, 5, 12), materials.wovenFiber));
    binding.position.y = 1.54 + index * 0.045;
    binding.rotation.x = Math.PI / 2;
    group.add(binding);
  }
  return group;
}

export function createResonanceForkModel(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = 'tide-resonance-fork';

  const handle = shadowed(new Mesh(new CylinderGeometry(0.06, 0.085, 0.84, 10), materials.darkWood));
  handle.position.y = 0.04;
  handle.rotation.z = -0.055;
  group.add(handle);

  for (let index = 0; index < 7; index += 1) {
    const binding = shadowed(new Mesh(new TorusGeometry(0.078, 0.011, 5, 14), materials.rope));
    binding.position.y = -0.24 + index * 0.053;
    binding.rotation.x = Math.PI / 2;
    binding.rotation.z = index * 0.07;
    group.add(binding);
  }

  const housing = shadowed(new Mesh(
    new RoundedBoxGeometry(0.36, 0.39, 0.22, 4, 0.045),
    materials.signalLaminate,
  ));
  housing.position.set(-0.01, 0.48, 0);
  housing.rotation.z = -0.04;
  group.add(housing);

  const cell = shadowed(new Mesh(new CylinderGeometry(0.075, 0.075, 0.29, 12), materials.navigationAlloy));
  cell.position.set(-0.02, 0.49, -0.135);
  cell.rotation.z = Math.PI / 2;
  group.add(cell);
  for (const side of [-1, 1]) {
    const cap = shadowed(new Mesh(new CylinderGeometry(0.084, 0.084, 0.025, 12), materials.metal));
    cap.position.set(side * 0.155 - 0.02, 0.49, -0.135);
    cap.rotation.z = Math.PI / 2;
    group.add(cap);
  }

  const coreMaterial = materials.phosphorGlass.clone();
  coreMaterial.emissive = new Color(0x5bd7c2);
  coreMaterial.emissiveIntensity = 0.22;
  const core = shadowed(new Mesh(new SphereGeometry(0.092, 14, 10), coreMaterial));
  core.name = 'resonance-pressure-core';
  core.position.set(0.075, 0.53, 0.13);
  core.scale.y = 1.28;
  group.add(core);

  const triggerPivot = new Group();
  triggerPivot.name = 'resonance-trigger-pivot';
  triggerPivot.position.set(-0.11, 0.37, 0.13);
  const trigger = shadowed(new Mesh(new RoundedBoxGeometry(0.07, 0.16, 0.055, 3, 0.018), materials.rustMetal));
  trigger.position.y = -0.06;
  triggerPivot.add(trigger);
  group.add(triggerPivot);

  const throat = shadowed(new Mesh(new CylinderGeometry(0.11, 0.14, 0.28, 10), materials.navigationAlloy));
  throat.position.y = 0.79;
  group.add(throat);
  const brace = shadowed(new Mesh(new RoundedBoxGeometry(0.45, 0.11, 0.15, 3, 0.025), materials.metal));
  brace.position.y = 0.91;
  group.add(brace);

  const tinePivots: Group[] = [];
  for (const side of [-1, 1]) {
    const tinePivot = new Group();
    tinePivot.name = side < 0 ? 'resonance-left-tine' : 'resonance-right-tine';
    tinePivot.position.set(side * 0.145, 0.91, 0);
    const tine = shadowed(new Mesh(new CylinderGeometry(0.031, 0.046, 0.87, 9), materials.navigationAlloy));
    tine.position.y = 0.42;
    const tip = shadowed(new Mesh(new ConeGeometry(0.064, 0.24, 9), coreMaterial));
    tip.position.y = 0.97;
    const electrode = shadowed(new Mesh(new TorusGeometry(0.048, 0.012, 6, 15), materials.metal));
    electrode.position.y = 0.77;
    electrode.rotation.x = Math.PI / 2;
    tinePivot.add(tine, tip, electrode);
    group.add(tinePivot);
    tinePivots.push(tinePivot);
  }

  const chargeRings: Mesh<BufferGeometry, MeshBasicMaterial>[] = [];
  for (let index = 0; index < 3; index += 1) {
    const ringMaterial = new MeshBasicMaterial({
      color: index === 2 ? 0xf2d36c : 0x68d9c6,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const ring = new Mesh(new TorusGeometry(0.19 + index * 0.015, 0.009, 6, 28), ringMaterial);
    ring.name = `resonance-charge-ring-${index + 1}`;
    ring.position.y = 1.08 + index * 0.22;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    chargeRings.push(ring);
  }

  const light = new PointLight(0x65e5ce, 0, 2.4, 2);
  light.position.copy(core.position);
  group.add(light);
  group.userData.resonanceVisuals = { core, chargeRings, tinePivots, triggerPivot, light } satisfies ResonanceForkVisuals;
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

export function createAxeModel(materials: MaterialLibrary, upgraded = false): Group {
  const axe = new Group();
  axe.name = upgraded ? 'tide-cast-broad-axe' : 'tide-stone-axe';
  const handle = shadowed(new Mesh(new CylinderGeometry(0.045, 0.07, 0.92, 9), materials.darkWood));
  handle.position.y = 0.12;
  handle.rotation.z = -0.08;
  axe.add(handle);

  const head = shadowed(new Mesh(
    upgraded ? new RoundedBoxGeometry(0.42, 0.24, 0.16, 3, 0.035) : new DodecahedronGeometry(0.19, 0),
    upgraded ? materials.metal : materials.rock,
  ));
  head.scale.set(upgraded ? 1 : 1.42, upgraded ? 1 : 0.8, upgraded ? 1 : 0.58);
  head.position.set(-0.02, 0.58, 0);
  head.rotation.z = 0.18;
  axe.add(head);

  const cuttingEdge = shadowed(new Mesh(new ConeGeometry(upgraded ? 0.25 : 0.18, upgraded ? 0.4 : 0.32, 4), materials.metal));
  cuttingEdge.position.set(upgraded ? -0.32 : -0.24, 0.58, 0);
  cuttingEdge.rotation.z = Math.PI / 2;
  cuttingEdge.scale.z = 0.42;
  axe.add(cuttingEdge);

  if (upgraded) {
    const counterweight = shadowed(new Mesh(new CylinderGeometry(0.095, 0.12, 0.2, 8), materials.rustMetal));
    counterweight.position.set(0.27, 0.58, 0);
    counterweight.rotation.z = Math.PI / 2;
    axe.add(counterweight);
  }

  const binding = new InstancedMesh(new TorusGeometry(0.073, 0.011, 5, 13), materials.wovenFiber, 6);
  const bindingMatrix = new Matrix4();
  const bindingPosition = new Vector3();
  const bindingRotation = new Quaternion();
  const bindingScale = new Vector3(1, 1, 1);
  const bindingEuler = new Euler();
  for (let index = 0; index < 6; index += 1) {
    bindingPosition.set(0, 0.43 + index * 0.045, 0);
    bindingRotation.setFromEuler(bindingEuler.set(Math.PI / 2, 0, index * 0.1));
    bindingMatrix.compose(bindingPosition, bindingRotation, bindingScale);
    binding.setMatrixAt(index, bindingMatrix);
  }
  binding.instanceMatrix.needsUpdate = true;
  binding.castShadow = true;
  binding.receiveShadow = true;
  axe.add(binding);
  return axe;
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

  const harvestMarks: Mesh[] = [];
  const markDefinitions = [
    { radius: 0.55, z: -0.48, angle: -0.22 },
    { radius: 0.58, z: 0.24, angle: 0.16 },
    { radius: 0.46, z: 0.92, angle: -0.12 },
  ];
  for (const [index, definition] of markDefinitions.entries()) {
    const mark = new Mesh(
      new TorusGeometry(definition.radius, 0.027, 5, 20, Math.PI * 0.76),
      materials.sharkMouth,
    );
    mark.name = `shark-harvest-mark-${index}`;
    mark.position.set(0, 0, definition.z);
    mark.rotation.z = definition.angle;
    mark.scale.y = 0.78;
    mark.visible = false;
    mark.renderOrder = 2;
    harvestMarks.push(mark);
    shark.add(mark);
  }

  shark.userData.tailPivot = tailPivot;
  shark.userData.body = body;
  shark.userData.harvestMarks = harvestMarks;
  shark.scale.setScalar(0.88);
  return shark;
}

export function createSharkLootDropModel(materials: MaterialLibrary): Group {
  const bundle = new Group();
  bundle.name = 'shark-harvest-drop';

  const float = shadowed(new Mesh(new RoundedBoxGeometry(0.98, 0.12, 0.58, 3, 0.06), materials.sealedCanvas));
  float.name = 'shark-loot-float';
  float.position.y = -0.07;
  float.rotation.y = -0.08;
  bundle.add(float);

  const hide = shadowed(new Mesh(new RoundedBoxGeometry(0.74, 0.1, 0.44, 3, 0.045), materials.sharkSkin));
  hide.name = 'shark-loot-hide';
  hide.position.y = 0.035;
  hide.rotation.y = -0.12;
  bundle.add(hide);

  const meatGeometry = new RoundedBoxGeometry(0.34, 0.2, 0.25, 3, 0.065);
  for (let index = 0; index < 3; index += 1) {
    const meat = shadowed(new Mesh(meatGeometry, materials.sharkMouth));
    meat.name = `shark-meat-cut-${index}`;
    meat.position.set(-0.3 + index * 0.3, 0.16 + (index % 2) * 0.035, -0.02 + (index % 2) * 0.12);
    meat.rotation.set(0.08 * index, -0.18 + index * 0.16, 0.04 * (index - 1));
    bundle.add(meat);
  }

  for (const [index, x] of [-0.18, 0.18].entries()) {
    const tooth = shadowed(new Mesh(new ConeGeometry(0.085, 0.28, 7), materials.sailCloth));
    tooth.name = `shark-tooth-plate-${index}`;
    tooth.position.set(x, 0.28, 0.27);
    tooth.rotation.x = Math.PI * 0.56;
    bundle.add(tooth);
  }

  for (const x of [-0.31, 0.31]) {
    const binding = shadowed(new Mesh(new TorusGeometry(0.28, 0.022, 5, 16), materials.rope));
    binding.position.x = x;
    binding.rotation.y = Math.PI / 2;
    binding.scale.z = 0.72;
    bundle.add(binding);
  }
  bundle.userData.kind = 'sharkLoot';
  return bundle;
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

function createBarrelDebris(materials: MaterialLibrary): Group {
  const group = new Group();
  const body = shadowed(new Mesh(new CylinderGeometry(0.32, 0.38, 0.82, 12, 3), materials.darkWood));
  body.rotation.z = Math.PI / 2;
  group.add(body);
  for (const x of [-0.31, 0, 0.31]) {
    const band = shadowed(new Mesh(new TorusGeometry(x === 0 ? 0.35 : 0.34, 0.026, 7, 20), materials.rustMetal));
    band.position.x = x;
    band.rotation.y = Math.PI / 2;
    group.add(band);
  }
  const bung = shadowed(new Mesh(new CylinderGeometry(0.055, 0.065, 0.045, 9), materials.polymer));
  bung.position.set(0.08, 0.34, 0);
  group.add(bung);
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
          : kind === 'barrel'
            ? createBarrelDebris(materials)
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

interface DeviceFireVisuals {
  fire: Group;
  light: PointLight;
  puffs: Mesh[];
  embers: Mesh[];
}

function createFireVisuals(smokeColor = 0xb9c2b5): DeviceFireVisuals {
  const fire = new Group();
  fire.name = 'device-fire';
  const flameGeometry = new SphereGeometry(0.12, 10, 7);
  const flameColors = [0xffd45b, 0xff8a3f, 0xe95032, 0xffb84a, 0xff7041];
  flameColors.forEach((color, index) => {
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: index < 2 ? 0.82 : 0.64,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const flame = new Mesh(flameGeometry, material);
    const angle = (index / flameColors.length) * Math.PI * 2;
    flame.position.set(Math.cos(angle) * 0.095, 0.08 + (index % 2) * 0.05, Math.sin(angle) * 0.075);
    flame.scale.set(0.58 + (index % 3) * 0.12, 1.15 + (index % 2) * 0.38, 0.58);
    flame.userData.phase = index * 1.73;
    flame.userData.baseX = flame.position.x;
    fire.add(flame);
  });
  const light = new PointLight(0xff8b48, 0, 2.35, 2);
  light.position.set(0, 0.28, 0);
  fire.add(light);

  const emberGeometry = new RoundedBoxGeometry(0.18, 0.045, 0.065, 2, 0.015);
  const emberMaterial = new MeshBasicMaterial({ color: 0x7b2c20 });
  const embers: Mesh[] = [];
  for (let index = 0; index < 5; index += 1) {
    const ember = new Mesh(emberGeometry, emberMaterial);
    ember.position.set((index - 2) * 0.09, 0.01 + (index % 2) * 0.025, (index % 2 - 0.5) * 0.11);
    ember.rotation.y = index * 1.2;
    embers.push(ember);
    fire.add(ember);
  }

  const puffs: Mesh[] = [];
  const puffGeometry = new SphereGeometry(0.11, 8, 6);
  for (let index = 0; index < 8; index += 1) {
    const puffMaterial = new MeshBasicMaterial({
      color: smokeColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const puff = new Mesh(puffGeometry, puffMaterial);
    puff.visible = false;
    puff.userData.phase = index / 8;
    puffs.push(puff);
  }
  return { fire, light, puffs, embers };
}

function addBoundFrame(group: Group, materials: MaterialLibrary, width: number, depth: number, height: number): void {
  const legGeometry = new CylinderGeometry(0.045, 0.06, height, 7);
  for (const x of [-width / 2, width / 2]) {
    for (const z of [-depth / 2, depth / 2]) {
      const leg = shadowed(new Mesh(legGeometry, materials.darkWood));
      leg.position.set(x, height / 2, z);
      leg.rotation.z = x * 0.08;
      leg.rotation.x = z * 0.08;
      group.add(leg);
      const binding = shadowed(new Mesh(new TorusGeometry(0.065, 0.009, 5, 12), materials.wovenFiber));
      binding.position.set(x, height * 0.63, z);
      binding.rotation.x = Math.PI / 2;
      group.add(binding);
    }
  }
  const railX = new BoxGeometry(width + 0.14, 0.07, 0.075);
  const railZ = new BoxGeometry(0.075, 0.07, depth + 0.14);
  for (const y of [0.14, height - 0.06]) {
    for (const z of [-depth / 2, depth / 2]) {
      const rail = shadowed(new Mesh(railX, materials.wood[(y > 0.2 ? 1 : 2) % materials.wood.length]));
      rail.position.set(0, y, z);
      group.add(rail);
    }
    for (const x of [-width / 2, width / 2]) {
      const rail = shadowed(new Mesh(railZ, materials.wood[(y > 0.2 ? 2 : 1) % materials.wood.length]));
      rail.position.set(x, y, 0);
      group.add(rail);
    }
  }
}

export function createPurifierModel(materials: MaterialLibrary): Group {
  const purifier = new Group();
  purifier.name = 'tide-still-purifier';
  addBoundFrame(purifier, materials, 0.82, 0.72, 0.86);

  const fireVisuals = createFireVisuals(0xd5e8df);
  fireVisuals.fire.position.set(0, 0.19, 0.03);
  purifier.add(fireVisuals.fire);
  fireVisuals.puffs.forEach((puff) => {
    puff.position.set(0, 0.78, 0);
    purifier.add(puff);
  });

  const heatBowl = shadowed(new Mesh(new CylinderGeometry(0.34, 0.27, 0.13, 16, 1, true), materials.rustMetal));
  heatBowl.position.y = 0.31;
  const bowlBottom = shadowed(new Mesh(new CylinderGeometry(0.27, 0.27, 0.035, 16), materials.metal));
  bowlBottom.position.y = 0.255;
  purifier.add(heatBowl, bowlBottom);

  const rawWaterMaterial = new MeshPhysicalMaterial({
    color: 0x318d91,
    roughness: 0.18,
    metalness: 0,
    transparent: true,
    opacity: 0.82,
    transmission: 0.08,
  });
  const rawWater = new Mesh(new CylinderGeometry(0.285, 0.285, 0.018, 20), rawWaterMaterial);
  rawWater.position.y = 0.36;
  purifier.add(rawWater);

  const hood = shadowed(new Mesh(new CylinderGeometry(0.2, 0.38, 0.34, 18, 1, true), materials.wovenFiber));
  hood.position.y = 0.59;
  const hoodCap = shadowed(new Mesh(new CylinderGeometry(0.2, 0.2, 0.04, 18), materials.metal));
  hoodCap.position.y = 0.77;
  const gutter = shadowed(new Mesh(new TorusGeometry(0.38, 0.026, 7, 26), materials.metal));
  gutter.position.y = 0.43;
  gutter.rotation.x = Math.PI / 2;
  purifier.add(hood, hoodCap, gutter);

  const spoutCurve = new CatmullRomCurve3([
    new Vector3(0.35, 0.46, 0),
    new Vector3(0.48, 0.43, 0),
    new Vector3(0.51, 0.35, 0),
    new Vector3(0.51, 0.29, 0),
  ]);
  purifier.add(shadowed(new Mesh(new TubeGeometry(spoutCurve, 14, 0.022, 7, false), materials.metal)));

  const cup = new Group();
  cup.name = 'purifier-collection-cup';
  cup.position.set(0.51, 0.18, 0);
  const cupMaterial = new MeshPhysicalMaterial({
    color: 0x7fc5ca,
    roughness: 0.34,
    transparent: true,
    opacity: 0.58,
    transmission: 0.2,
    thickness: 0.05,
  });
  const cupWall = new Mesh(new CylinderGeometry(0.12, 0.095, 0.24, 14, 1, true), cupMaterial);
  cupWall.position.y = 0.12;
  const cupRim = new Mesh(new TorusGeometry(0.12, 0.012, 6, 18), materials.polymer);
  cupRim.position.y = 0.24;
  cupRim.rotation.x = Math.PI / 2;
  const cleanWater = new Mesh(
    new CylinderGeometry(0.096, 0.096, 0.012, 16),
    new MeshPhysicalMaterial({ color: 0x65d7e7, roughness: 0.12, transparent: true, opacity: 0.86 }),
  );
  cleanWater.position.y = 0.08;
  cleanWater.visible = false;
  cup.add(cupWall, cupRim, cleanWater);
  purifier.add(cup);

  const drip = new Mesh(
    new SphereGeometry(0.026, 8, 6),
    new MeshPhysicalMaterial({ color: 0x8ae5ee, roughness: 0.08, transparent: true, opacity: 0.9 }),
  );
  drip.position.set(0.51, 0.27, 0);
  drip.scale.y = 1.8;
  drip.visible = false;
  purifier.add(drip);

  const pressureBand = shadowed(new Mesh(new TorusGeometry(0.245, 0.014, 5, 22), materials.rope));
  pressureBand.position.y = 0.69;
  pressureBand.rotation.x = Math.PI / 2;
  purifier.add(pressureBand);

  purifier.userData.deviceVisuals = {
    ...fireVisuals,
    rawWater,
    cleanWater,
    drip,
  } satisfies DeviceModelVisuals;
  return purifier;
}

export function createGrillModel(materials: MaterialLibrary): Group {
  const grill = new Group();
  grill.name = 'folded-iron-grill';
  addBoundFrame(grill, materials, 0.8, 0.7, 0.48);

  const fireVisuals = createFireVisuals(0x848580);
  fireVisuals.fire.position.set(0, 0.22, 0);
  grill.add(fireVisuals.fire);
  fireVisuals.puffs.forEach((puff) => {
    puff.position.set(0, 0.62, 0);
    grill.add(puff);
  });

  const firePan = shadowed(new Mesh(new CylinderGeometry(0.4, 0.31, 0.14, 16, 1, true), materials.rustMetal));
  firePan.position.y = 0.27;
  const panBase = shadowed(new Mesh(new CylinderGeometry(0.31, 0.31, 0.035, 16), materials.rustMetal));
  panBase.position.y = 0.21;
  grill.add(firePan, panBase);

  const grateMaterial = materials.metal;
  for (let index = -4; index <= 4; index += 1) {
    const rod = shadowed(new Mesh(new CylinderGeometry(0.012, 0.012, 0.76, 7), grateMaterial));
    rod.position.set(index * 0.085, 0.42, 0);
    rod.rotation.x = Math.PI / 2;
    grill.add(rod);
  }
  for (const z of [-0.31, 0.31]) {
    const brace = shadowed(new Mesh(new CylinderGeometry(0.018, 0.018, 0.86, 7), materials.rustMetal));
    brace.position.set(0, 0.415, z);
    brace.rotation.z = Math.PI / 2;
    grill.add(brace);
  }

  const food = createSilverSpineFishModel(materials);
  food.name = 'grill-fish';
  food.position.set(0, 0.49, 0);
  food.rotation.y = Math.PI / 2;
  food.rotation.z = Math.PI / 2;
  food.scale.setScalar(0.48);
  const foodMeshes: Mesh<BufferGeometry, MeshStandardMaterial>[] = [];
  food.traverse((object) => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
    const sourceMaterial = object.material;
    object.material = sourceMaterial.clone();
    if (!isLibraryMaterial(sourceMaterial, materials)) sourceMaterial.dispose();
    object.material.userData.rawColor = object.material.color.getHex();
    foodMeshes.push(object as Mesh<BufferGeometry, MeshStandardMaterial>);
  });
  food.visible = false;
  grill.add(food);

  const handle = shadowed(new Mesh(new TorusGeometry(0.21, 0.025, 7, 20, Math.PI), materials.metal));
  handle.position.set(0.46, 0.31, 0);
  handle.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  grill.add(handle);

  grill.userData.deviceVisuals = {
    ...fireVisuals,
    food,
    foodMeshes,
  } satisfies DeviceModelVisuals;
  return grill;
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

const TERRAIN_SAND = new Color(0xd6bf86);
const TERRAIN_DRY_GRASS = new Color(0x80915d);
const TERRAIN_GREEN = new Color(0x5e8053);
const TERRAIN_STONE = new Color(0x77756b);
const TERRAIN_SUBMERGED = new Color(0x547d72);

function terrainColor(height: number, x: number, z: number, target: Color): Color {
  if (height < 0.12) return target.copy(TERRAIN_SAND).multiplyScalar(0.9 + Math.sin(x * 2.7 + z) * 0.025);
  if (height < 0.62) return target.copy(TERRAIN_SAND).lerp(TERRAIN_DRY_GRASS, MathUtils.smoothstep(height, 0.12, 0.62));
  if (height < 1.8) return target.copy(TERRAIN_DRY_GRASS).lerp(TERRAIN_GREEN, MathUtils.smoothstep(height, 0.62, 1.5));
  return target.copy(TERRAIN_GREEN).lerp(TERRAIN_STONE, MathUtils.smoothstep(height, 1.8, 2.75));
}

export function createExplorableIsland(materials: MaterialLibrary, seed: number): Group {
  const island = new Group();
  island.name = 'explorable-saltcrown-island';
  const segmentsX = 44;
  const segmentsZ = 46;
  const width = ISLAND_RADIUS_X * 2.22;
  const depth = ISLAND_RADIUS_Z * 2.22;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new Color();
  for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
    const z = (zIndex / segmentsZ - 0.5) * depth;
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const x = (xIndex / segmentsX - 0.5) * width;
      const sampled = sampleIslandHeight(seed, x, z);
      const radial = Math.sqrt((x / ISLAND_RADIUS_X) ** 2 + (z / ISLAND_RADIUS_Z) ** 2);
      const height = sampled ?? -0.68 - Math.max(0, radial - 1.08) * 1.8;
      positions.push(x, height, z);
      terrainColor(height, x, z, color);
      if (height < -0.05) color.lerp(TERRAIN_SUBMERGED, MathUtils.clamp((-height - 0.05) * 0.5, 0, 0.42));
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      const row = segmentsX + 1;
      const a = zIndex * row + xIndex;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      if ((xIndex + zIndex) % 2 === 0) indices.push(a, c, b, b, c, d);
      else indices.push(a, c, d, a, d, b);
    }
  }
  const terrainGeometry = new BufferGeometry();
  terrainGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  terrainGeometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  terrainGeometry.setIndex(indices);
  terrainGeometry.computeVertexNormals();
  const terrainMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
  });
  const terrain = shadowed(new Mesh(terrainGeometry, terrainMaterial));
  terrain.name = 'island-heightfield';
  island.add(terrain);

  const obstacles = [
    { x: -4.15, z: -1.45, radius: 0.72, scale: [1.05, 0.82, 1.34] },
    { x: 4.1, z: -1.1, radius: 0.68, scale: [0.92, 1.18, 1.02] },
    { x: -0.2, z: -3.75, radius: 0.62, scale: [1.18, 0.76, 0.88] },
    { x: 3.95, z: 2.55, radius: 0.58, scale: [0.88, 0.7, 1.2] },
    { x: -3.9, z: 2.95, radius: 0.54, scale: [0.82, 0.68, 1.02] },
  ] as const;
  const rockGeometry = new DodecahedronGeometry(0.68, 1);
  const rocks = new InstancedMesh(rockGeometry, materials.rock, obstacles.length);
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const euler = new Euler();
  obstacles.forEach((obstacle, index) => {
    const height = sampleIslandHeight(seed, obstacle.x, obstacle.z) ?? 0;
    position.set(obstacle.x, height + obstacle.scale[1] * 0.33, obstacle.z);
    rotation.setFromEuler(euler.set(index * 0.13, index * 1.17, index * 0.09));
    scale.set(obstacle.scale[0], obstacle.scale[1], obstacle.scale[2]);
    matrix.compose(position, rotation, scale);
    rocks.setMatrixAt(index, matrix);
  });
  rocks.instanceMatrix.needsUpdate = true;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  island.add(rocks);

  const shrubGeometry = new DodecahedronGeometry(0.24, 1);
  const shrubs = new InstancedMesh(shrubGeometry, materials.foliage, 22);
  const randomPhase = (seed % 997) * 0.17;
  let shrubCount = 0;
  for (let index = 0; index < 34 && shrubCount < 22; index += 1) {
    const angle = index * 2.399 + randomPhase;
    const radius = 1.2 + ((index * 1.73) % 1) * 3.6;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.86;
    if (Math.abs(x) < 1.15 && z > 2.3) continue;
    const height = sampleIslandHeight(seed, x, z);
    if (height === null || height < 0.3) continue;
    position.set(x, height + 0.2, z);
    rotation.setFromEuler(euler.set(0, angle * 1.7, 0));
    const scalar = 0.72 + (index % 4) * 0.13;
    scale.set(scalar * 1.2, scalar, scalar);
    matrix.compose(position, rotation, scale);
    shrubs.setMatrixAt(shrubCount, matrix);
    shrubCount += 1;
  }
  shrubs.count = shrubCount;
  shrubs.instanceMatrix.needsUpdate = true;
  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  island.add(shrubs);

  const foam: Mesh[] = [];
  const foamMaterials = [0.16, 0.23, 0.31].map(
    (opacity) => new MeshBasicMaterial({
      color: 0xe8f5e8,
      transparent: true,
      opacity,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  const foamGeometry = new PlaneGeometry(1.05, 0.2, 4, 1);
  for (let index = 0; index < 30; index += 1) {
    const angle = (index / 30) * Math.PI * 2;
    const x = Math.cos(angle) * ISLAND_RADIUS_X * 0.94;
    const z = Math.sin(angle) * ISLAND_RADIUS_Z * 0.94;
    const strip = new Mesh(foamGeometry, foamMaterials[index % foamMaterials.length]);
    strip.position.set(x, -0.08 + Math.sin(index * 2.1) * 0.025, z);
    strip.rotation.set(-Math.PI / 2, 0, -angle + Math.PI / 2);
    strip.scale.x = 0.72 + (index % 5) * 0.08;
    strip.userData.phase = index / 30;
    foam.push(strip);
    island.add(strip);
  }

  island.userData.islandVisuals = {
    foam,
    obstacles: obstacles.map(({ x, z, radius }) => ({ x, z, radius })),
  } satisfies IslandModelVisuals;
  return island;
}

function createHighlightRing(radius: number): Mesh {
  const ring = new Mesh(
    new TorusGeometry(radius, 0.018, 5, 28),
    new MeshBasicMaterial({ color: 0xefc35c, transparent: true, opacity: 0.72, depthWrite: false }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.035;
  ring.visible = false;
  return ring;
}

export function createHarvestNodeModel(type: HarvestNodeType, materials: MaterialLibrary): Group {
  const node = new Group();
  node.name = `island-resource-${type}`;
  const pivot = new Group();
  node.add(pivot);
  let stump: Mesh | null = null;
  let radius = 0.38;
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3(1, 1, 1);
  const euler = new Euler();
  const finishInstances = (mesh: InstancedMesh): InstancedMesh => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  if (type === 'palm') {
    radius = 0.62;
    const trunkSegments = 4;
    const trunks = new InstancedMesh(new CylinderGeometry(0.13, 0.18, 0.76, 8), materials.darkWood, trunkSegments);
    const rings = new InstancedMesh(new TorusGeometry(0.155, 0.012, 5, 12), materials.rope, trunkSegments);
    for (let index = 0; index < trunkSegments; index += 1) {
      const taper = 1 - index * 0.07;
      position.set(Math.sin(index * 0.7) * 0.035, 0.38 + index * 0.7, Math.cos(index * 0.8) * 0.025);
      rotation.setFromEuler(euler.set(0, 0, -0.025 + index * 0.018));
      scale.set(taper, 1, taper);
      matrix.compose(position, rotation, scale);
      trunks.setMatrixAt(index, matrix);
      position.y -= 0.22;
      rotation.setFromEuler(euler.set(Math.PI / 2, 0, index * 0.08));
      scale.setScalar(taper);
      matrix.compose(position, rotation, scale);
      rings.setMatrixAt(index, matrix);
    }
    pivot.add(finishInstances(trunks), finishInstances(rings));
    const leafGeometry = createPalmLeaf(materials.foliage).geometry;
    const leaves = new InstancedMesh(leafGeometry, materials.foliage, 9);
    for (let index = 0; index < 9; index += 1) {
      position.set(0.05, 2.83, 0);
      rotation.setFromEuler(
        euler.set(-0.34 - (index % 2) * 0.08, (index / 9) * Math.PI * 2, (index % 3 - 1) * 0.08, 'YXZ'),
      );
      scale.setScalar(1.28 + (index % 3) * 0.09);
      matrix.compose(position, rotation, scale);
      leaves.setMatrixAt(index, matrix);
    }
    pivot.add(finishInstances(leaves));
    const fruits = new InstancedMesh(new SphereGeometry(0.115, 9, 7), materials.leaf, 3);
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2;
      position.set(Math.cos(angle) * 0.17, 2.63 - index * 0.04, Math.sin(angle) * 0.17);
      rotation.identity();
      scale.set(1, 1.2, 1);
      matrix.compose(position, rotation, scale);
      fruits.setMatrixAt(index, matrix);
    }
    pivot.add(finishInstances(fruits));
    stump = shadowed(new Mesh(new CylinderGeometry(0.15, 0.2, 0.28, 8), materials.darkWood));
    stump.position.y = 0.14;
    stump.visible = false;
    node.add(stump);
  } else if (type === 'branch') {
    const branches = new InstancedMesh(new CylinderGeometry(0.035, 0.055, 0.88, 7), materials.wood[1], 4);
    for (let index = 0; index < 4; index += 1) {
      position.set((index - 1.5) * 0.13, 0.11 + (index % 2) * 0.04, (index % 2 - 0.5) * 0.2);
      rotation.setFromEuler(euler.set(Math.PI / 2 - 0.12, index * 0.6, 0.18 * (index - 1)));
      scale.set(1, 1 - index * 0.09, 1);
      matrix.compose(position, rotation, scale);
      branches.setMatrixAt(index, matrix);
    }
    pivot.add(finishInstances(branches));
  } else if (type === 'stone') {
    const stones = new InstancedMesh(new DodecahedronGeometry(0.2, 0), materials.rock, 5);
    for (let index = 0; index < 5; index += 1) {
      position.set((index % 3 - 1) * 0.2, 0.12 + (index % 2) * 0.08, (Math.floor(index / 3) - 0.35) * 0.24);
      rotation.setFromEuler(euler.set(index * 0.4, index * 0.9, index * 0.27));
      scale.setScalar(0.85 + (index % 3) * 0.225);
      matrix.compose(position, rotation, scale);
      stones.setMatrixAt(index, matrix);
    }
    pivot.add(finishInstances(stones));
  } else if (type === 'fruit') {
    radius = 0.34;
    const fruits = new InstancedMesh(new SphereGeometry(0.16, 10, 8), materials.leaf, 4);
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2;
      position.set(Math.cos(angle) * 0.15, 0.14 + (index % 2) * 0.1, Math.sin(angle) * 0.15);
      rotation.identity();
      scale.set(1, 1.28, 1);
      matrix.compose(position, rotation, scale);
      fruits.setMatrixAt(index, matrix);
    }
    pivot.add(finishInstances(fruits));
    const leaf = createPalmLeaf(materials.foliage, 0.45);
    leaf.position.y = 0.29;
    leaf.rotation.x = -0.5;
    pivot.add(leaf);
  } else {
    radius = 0.42;
    const leaves = new InstancedMesh(createPalmLeaf(materials.leaf).geometry, materials.leaf, 7);
    for (let index = 0; index < 7; index += 1) {
      position.set(0, 0.04, 0);
      rotation.setFromEuler(euler.set(-0.74, (index / 7) * Math.PI * 2, (index % 2) * 0.12, 'YXZ'));
      scale.setScalar(0.55 + (index % 3) * 0.08);
      matrix.compose(position, rotation, scale);
      leaves.setMatrixAt(index, matrix);
    }
    pivot.add(finishInstances(leaves));
  }
  const highlight = createHighlightRing(radius);
  node.add(highlight);
  node.userData.harvestVisuals = { pivot, stump, highlight } satisfies HarvestModelVisuals;
  return node;
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
