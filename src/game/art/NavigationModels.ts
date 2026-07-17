import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { MaterialLibrary } from './Materials';

export interface SailModelVisuals {
  kind: 'sail';
  pivot: Group;
  cloth: Mesh<BufferGeometry>;
  clothBase: Float32Array;
  streamer: Mesh<PlaneGeometry>;
  streamerPivot: Group;
  reinforcement: Group;
  highlight: Mesh;
}

export interface AnchorModelVisuals {
  kind: 'anchor';
  wheel: Group;
  rope: Mesh<CylinderGeometry>;
  anchor: Group;
  highlight: Mesh;
}

export interface HelmModelVisuals {
  kind: 'helm';
  wheel: Group;
  compassNeedle: Group;
  gimbal: Group;
  routePins: Mesh[];
  gears: Group[];
  highlight: Mesh;
}

export type NavigationModelVisuals = SailModelVisuals | AnchorModelVisuals | HelmModelVisuals;

function shadowed<T extends Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createHighlight(radius: number): Mesh {
  const material = new MeshStandardMaterial({
    color: 0xefc35c,
    emissive: 0x594415,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.32,
    roughness: 0.72,
    depthWrite: false,
  });
  const ring = new Mesh(new TorusGeometry(radius, 0.022, 6, 28), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.065;
  ring.visible = false;
  ring.renderOrder = 3;
  return ring;
}

function createClothGeometry(): BufferGeometry {
  const rows = 11;
  const columns = 8;
  const width = 1.54;
  const height = 2.34;
  const bottom = 0.68;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const rowWidth = width * (1 - v * 0.8);
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      positions.push(0.075 + u * rowWidth, bottom + v * height, Math.sin(u * Math.PI) * 0.025);
      uvs.push(u, 1 - v);
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addRigging(group: Group, materials: MaterialLibrary, points: Vector3[]): void {
  const curve = new CatmullRomCurve3(points);
  const rope = shadowed(new Mesh(new TubeGeometry(curve, 16, 0.012, 5, false), materials.rope));
  group.add(rope);
}

export function createSailModel(materials: MaterialLibrary): Group {
  const sail = new Group();
  sail.name = 'reclaimed-wind-sail';

  const foot = shadowed(new Mesh(new CylinderGeometry(0.18, 0.23, 0.17, 10), materials.rustMetal));
  foot.position.y = 0.1;
  const mast = shadowed(new Mesh(new CylinderGeometry(0.047, 0.067, 3.36, 9), materials.darkWood));
  mast.position.y = 1.74;
  const mastCap = shadowed(new Mesh(new SphereGeometry(0.075, 9, 6), materials.metal));
  mastCap.position.y = 3.43;
  sail.add(foot, mast, mastCap);

  for (const y of [0.3, 0.82, 2.95]) {
    const binding = shadowed(new Mesh(new TorusGeometry(y < 0.4 ? 0.09 : 0.063, 0.012, 5, 16), materials.rope));
    binding.rotation.x = Math.PI / 2;
    binding.position.y = y;
    sail.add(binding);
  }

  addRigging(sail, materials, [new Vector3(0, 3.34, 0), new Vector3(-0.28, 2.1, -0.16), new Vector3(-0.52, 0.08, -0.48)]);
  addRigging(sail, materials, [new Vector3(0, 3.34, 0), new Vector3(-0.25, 2.02, 0.18), new Vector3(-0.5, 0.08, 0.5)]);

  const pivot = new Group();
  pivot.name = 'sail-course-pivot';
  const boom = shadowed(new Mesh(new CylinderGeometry(0.035, 0.05, 1.7, 8), materials.darkWood));
  boom.rotation.z = Math.PI / 2;
  boom.position.set(0.82, 0.66, 0);
  pivot.add(boom);

  const clothGeometry = createClothGeometry();
  const cloth = shadowed(new Mesh(clothGeometry, materials.sailCloth));
  cloth.name = 'billowing-sailcloth';
  const clothBase = new Float32Array(
    (clothGeometry.getAttribute('position') as BufferAttribute).array as Float32Array,
  );
  pivot.add(cloth);

  addRigging(pivot, materials, [new Vector3(0.08, 3.02, 0), new Vector3(0.68, 2.18, 0.02), new Vector3(1.61, 0.68, 0)]);
  addRigging(pivot, materials, [new Vector3(0.08, 0.68, 0), new Vector3(0.82, 0.66, 0.015), new Vector3(1.63, 0.68, 0)]);
  for (const y of [1.33, 1.96]) {
    addRigging(pivot, materials, [new Vector3(0.07, y, 0.022), new Vector3(0.5, y + 0.02, 0.04), new Vector3(0.95, y, 0.022)]);
  }
  sail.add(pivot);

  const streamerPivot = new Group();
  streamerPivot.position.y = 3.48;
  const streamer = new Mesh(new PlaneGeometry(0.48, 0.105, 4, 1), materials.sailCloth);
  streamer.position.x = 0.24;
  streamer.rotation.x = -0.08;
  streamerPivot.add(streamer);
  sail.add(streamerPivot);

  const reinforcement = new Group();
  reinforcement.name = 'storm-rig-reinforcement';
  for (const [y, length] of [[1.31, 1.12], [1.95, 0.78]] as const) {
    const batten = shadowed(new Mesh(new CylinderGeometry(0.018, 0.024, length, 7), materials.navigationAlloy));
    batten.rotation.z = Math.PI / 2;
    batten.position.set(length * 0.5 + 0.07, y, 0.055);
    reinforcement.add(batten);
    for (const x of [0.09, length]) {
      const clamp = shadowed(new Mesh(new TorusGeometry(0.035, 0.009, 5, 14), materials.navigationAlloy));
      clamp.position.set(x, y, 0.06);
      clamp.rotation.y = Math.PI / 2;
      reinforcement.add(clamp);
    }
  }
  addRigging(reinforcement, materials, [new Vector3(0.08, 2.98, 0.055), new Vector3(0.7, 1.88, 0.09), new Vector3(1.57, 0.7, 0.055)]);
  addRigging(reinforcement, materials, [new Vector3(0.08, 0.72, 0.06), new Vector3(0.56, 1.52, 0.1), new Vector3(0.42, 2.5, 0.06)]);
  reinforcement.visible = false;
  pivot.add(reinforcement);

  const highlight = createHighlight(0.34);
  sail.add(highlight);
  sail.userData.navigationVisuals = {
    kind: 'sail',
    pivot,
    cloth,
    clothBase,
    streamer,
    streamerPivot,
    reinforcement,
    highlight,
  } satisfies SailModelVisuals;
  return sail;
}

export function createHelmModel(materials: MaterialLibrary): Group {
  const helm = new Group();
  helm.name = 'tide-lock-navigation-helm';

  const base = shadowed(new Mesh(new BoxGeometry(0.92, 0.12, 0.68), materials.wood[1]));
  base.position.y = 0.08;
  helm.add(base);
  for (const x of [-0.36, 0.36]) {
    const foot = shadowed(new Mesh(new CylinderGeometry(0.07, 0.09, 0.56, 8), materials.darkWood));
    foot.position.set(x, 0.37, 0.08);
    foot.rotation.z = x * 0.06;
    helm.add(foot);
    const brace = shadowed(new Mesh(new CylinderGeometry(0.024, 0.024, 0.58, 7), materials.navigationAlloy));
    brace.position.set(x * 0.52, 0.37, -0.16);
    brace.rotation.z = x > 0 ? -0.68 : 0.68;
    helm.add(brace);
  }

  const console = shadowed(new Mesh(new BoxGeometry(0.76, 0.42, 0.43), materials.darkWood));
  console.position.set(0, 0.7, -0.05);
  console.rotation.x = -0.16;
  helm.add(console);
  const face = shadowed(new Mesh(new BoxGeometry(0.68, 0.29, 0.045), materials.navigationAlloy));
  face.position.set(0, 0.76, 0.17);
  face.rotation.x = -0.16;
  helm.add(face);

  const wheel = new Group();
  wheel.name = 'helm-wheel';
  wheel.position.set(0, 1.08, 0.31);
  const rim = shadowed(new Mesh(new TorusGeometry(0.38, 0.034, 8, 36), materials.navigationAlloy));
  wheel.add(rim);
  for (let spoke = 0; spoke < 8; spoke += 1) {
    const angle = spoke / 8 * Math.PI * 2;
    const bar = shadowed(new Mesh(new CylinderGeometry(0.017, 0.024, 0.67, 7), materials.navigationAlloy));
    bar.rotation.z = angle + Math.PI / 2;
    const handle = shadowed(new Mesh(new CylinderGeometry(0.025, 0.035, 0.16, 8), materials.darkWood));
    handle.position.set(Math.cos(angle) * 0.45, Math.sin(angle) * 0.45, 0);
    handle.rotation.z = angle + Math.PI / 2;
    wheel.add(bar, handle);
  }
  const hub = shadowed(new Mesh(new CylinderGeometry(0.095, 0.095, 0.18, 12), materials.navigationAlloy));
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  helm.add(wheel);

  const gimbal = new Group();
  gimbal.name = 'helm-compass-gimbal';
  gimbal.position.set(0, 0.87, -0.12);
  const outerRing = shadowed(new Mesh(new TorusGeometry(0.19, 0.018, 7, 30), materials.navigationAlloy));
  outerRing.rotation.x = Math.PI / 2;
  const innerRing = shadowed(new Mesh(new TorusGeometry(0.14, 0.013, 7, 28), materials.metal));
  innerRing.rotation.x = Math.PI / 2;
  gimbal.add(outerRing, innerRing);
  const compassNeedle = new Group();
  const needle = shadowed(new Mesh(new BoxGeometry(0.025, 0.018, 0.22), materials.rustMetal));
  needle.position.z = -0.045;
  const needleTip = shadowed(new Mesh(new ConeGeometry(0.035, 0.1, 6), materials.navigationAlloy));
  needleTip.position.z = -0.17;
  needleTip.rotation.x = -Math.PI / 2;
  compassNeedle.add(needle, needleTip);
  gimbal.add(compassNeedle);
  helm.add(gimbal);

  const routePins: Mesh[] = [];
  [-0.19, 0, 0.19].forEach((x, index) => {
    const pin = new Mesh(new SphereGeometry(0.026, 8, 6), materials.navigationAlloy.clone());
    pin.position.set(x, 0.76, 0.205);
    pin.userData.routeIndex = index;
    routePins.push(pin);
    helm.add(pin);
  });

  const gears: Group[] = [];
  for (const [x, radius, teeth] of [[-0.23, 0.095, 10], [0.04, 0.13, 12], [0.27, 0.075, 8]] as const) {
    const gear = new Group();
    gear.position.set(x, 0.49, 0.18);
    const gearCore = shadowed(new Mesh(new CylinderGeometry(radius, radius, 0.04, teeth), materials.navigationAlloy));
    gearCore.rotation.x = Math.PI / 2;
    gear.add(gearCore);
    for (let tooth = 0; tooth < teeth; tooth += 1) {
      const angle = tooth / teeth * Math.PI * 2;
      const block = shadowed(new Mesh(new BoxGeometry(0.025, 0.045, 0.04), materials.navigationAlloy));
      block.position.set(Math.cos(angle) * (radius + 0.012), Math.sin(angle) * (radius + 0.012), 0);
      block.rotation.z = angle;
      gear.add(block);
    }
    gears.push(gear);
    helm.add(gear);
  }

  for (const x of [-0.34, 0.34]) {
    const tillerLine = shadowed(new Mesh(new CylinderGeometry(0.012, 0.012, 0.58, 6), materials.rope));
    tillerLine.position.set(x, 0.42, -0.32);
    tillerLine.rotation.x = Math.PI / 2;
    helm.add(tillerLine);
  }

  const highlight = createHighlight(0.55);
  helm.add(highlight);
  helm.userData.navigationVisuals = {
    kind: 'helm',
    wheel,
    compassNeedle,
    gimbal,
    routePins,
    gears,
    highlight,
  } satisfies HelmModelVisuals;
  return helm;
}

export function createAnchorModel(materials: MaterialLibrary): Group {
  const assembly = new Group();
  assembly.name = 'tide-stone-anchor-winch';

  const base = shadowed(new Mesh(new BoxGeometry(0.82, 0.1, 0.52), materials.wood[1]));
  base.position.y = 0.08;
  assembly.add(base);
  for (const x of [-0.34, 0.34]) {
    const upright = shadowed(new Mesh(new BoxGeometry(0.1, 0.56, 0.16), materials.darkWood));
    upright.position.set(x, 0.36, 0);
    upright.rotation.z = x * 0.08;
    assembly.add(upright);
    const binding = shadowed(new Mesh(new TorusGeometry(0.075, 0.012, 5, 14), materials.rope));
    binding.position.set(x, 0.22, 0);
    binding.rotation.y = Math.PI / 2;
    assembly.add(binding);
  }

  const wheel = new Group();
  wheel.name = 'anchor-winch-wheel';
  wheel.position.y = 0.46;
  const drum = shadowed(new Mesh(new CylinderGeometry(0.2, 0.2, 0.58, 12), materials.darkWood));
  drum.rotation.z = Math.PI / 2;
  wheel.add(drum);
  for (const x of [-0.3, 0.3]) {
    const rim = shadowed(new Mesh(new TorusGeometry(0.25, 0.027, 7, 22), materials.rustMetal));
    rim.position.x = x;
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
  }
  const crank = shadowed(new Mesh(new CylinderGeometry(0.018, 0.018, 0.34, 7), materials.metal));
  crank.rotation.z = Math.PI / 2;
  crank.position.set(0.42, 0.18, 0);
  wheel.add(crank);
  assembly.add(wheel);

  for (let ring = 0; ring < 4; ring += 1) {
    const coil = shadowed(new Mesh(new TorusGeometry(0.17 + ring * 0.017, 0.015, 5, 24), materials.rope));
    coil.rotation.x = Math.PI / 2;
    coil.position.set(0, 0.15 + ring * 0.006, 0.22);
    assembly.add(coil);
  }

  const rope = shadowed(new Mesh(new CylinderGeometry(0.018, 0.018, 2.8, 7), materials.rope));
  rope.position.set(0, -1.2, 0.58);
  rope.visible = false;
  assembly.add(rope);

  const anchor = new Group();
  anchor.name = 'submerged-stone-anchor';
  const shaft = shadowed(new Mesh(new CylinderGeometry(0.045, 0.055, 0.68, 8), materials.rustMetal));
  shaft.position.y = -0.12;
  const crown = shadowed(new Mesh(new CylinderGeometry(0.08, 0.08, 0.54, 8), materials.rustMetal));
  crown.rotation.z = Math.PI / 2;
  crown.position.y = -0.42;
  const stone = shadowed(new Mesh(new SphereGeometry(0.19, 9, 7), materials.rock));
  stone.scale.set(1.25, 0.82, 0.88);
  stone.position.y = -0.33;
  anchor.add(shaft, crown, stone);
  for (const direction of [-1, 1]) {
    const fluke = shadowed(new Mesh(new ConeGeometry(0.16, 0.36, 7), materials.rustMetal));
    fluke.rotation.z = direction * 1.05;
    fluke.position.set(direction * 0.32, -0.38, 0);
    anchor.add(fluke);
  }
  anchor.position.set(0, 0.32, 0.58);
  assembly.add(anchor);

  const highlight = createHighlight(0.52);
  assembly.add(highlight);
  assembly.userData.navigationVisuals = {
    kind: 'anchor',
    wheel,
    rope,
    anchor,
    highlight,
  } satisfies AnchorModelVisuals;
  return assembly;
}
