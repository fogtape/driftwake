import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MaterialLibrary } from './Materials';

export interface ResearchBenchVisuals {
  dial: Group;
  page: Mesh;
  indicator: MeshBasicMaterial;
  highlight: Mesh;
}

export interface DryingRackVisuals {
  bricks: Mesh<BoxGeometry, MeshStandardMaterial>[];
  highlight: Mesh;
}

export interface SmelterVisuals {
  fire: Group;
  light: PointLight;
  smoke: Mesh[];
  sparks: Mesh[];
  ore: Mesh;
  ingot: Mesh;
  crucible: Group;
  door: Group;
  heatGlow: MeshBasicMaterial;
  highlight: Mesh;
}

function shadowed<T extends Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createHighlight(radius: number): Mesh {
  const highlight = new Mesh(
    new TorusGeometry(radius, 0.018, 6, 42),
    new MeshBasicMaterial({ color: 0x83e0bc, transparent: true, opacity: 0.68, depthWrite: false }),
  );
  highlight.position.y = 0.075;
  highlight.rotation.x = Math.PI / 2;
  highlight.visible = false;
  return highlight;
}

export function createResearchBenchModel(materials: MaterialLibrary): Group {
  const bench = new Group();
  bench.name = 'salt-trace-research-bench';

  const top = shadowed(new Mesh(new RoundedBoxGeometry(1.06, 0.12, 0.78, 3, 0.035), materials.wood[1]));
  top.position.y = 0.74;
  bench.add(top);
  for (const x of [-0.43, 0.43]) {
    for (const z of [-0.29, 0.29]) {
      const leg = shadowed(new Mesh(new CylinderGeometry(0.055, 0.075, 0.7, 8), materials.darkWood));
      leg.position.set(x, 0.37, z);
      leg.rotation.z = x * 0.035;
      bench.add(leg);
      const foot = shadowed(new Mesh(new CylinderGeometry(0.095, 0.075, 0.055, 8), materials.rustMetal));
      foot.position.set(x, 0.055, z);
      bench.add(foot);
    }
  }

  const shelf = shadowed(new Mesh(new BoxGeometry(0.86, 0.065, 0.56), materials.wood[2]));
  shelf.position.y = 0.36;
  bench.add(shelf);
  for (const z of [-0.28, 0.28]) {
    const brace = shadowed(new Mesh(new CylinderGeometry(0.018, 0.018, 0.9, 6), materials.rustMetal));
    brace.position.set(0, 0.49, z);
    brace.rotation.z = Math.PI / 2;
    bench.add(brace);
  }

  const board = shadowed(new Mesh(new RoundedBoxGeometry(0.72, 0.56, 0.055, 3, 0.025), materials.darkWood));
  board.position.set(0.08, 1.07, -0.32);
  board.rotation.x = -0.08;
  bench.add(board);
  const pageMaterial = new MeshStandardMaterial({ color: 0xd8d2b8, roughness: 0.92, side: DoubleSide });
  const page = shadowed(new Mesh(new PlaneGeometry(0.57, 0.4, 2, 2), pageMaterial));
  page.position.set(0.08, 1.08, -0.287);
  page.rotation.x = -0.08;
  bench.add(page);
  for (let line = 0; line < 4; line += 1) {
    const mark = new Mesh(new BoxGeometry(0.34 - line * 0.035, 0.009, 0.006), materials.rustMetal);
    mark.position.set(0.04, 1.2 - line * 0.075, -0.256);
    mark.rotation.x = -0.08;
    bench.add(mark);
  }

  const sampleTray = shadowed(new Mesh(new CylinderGeometry(0.23, 0.25, 0.045, 16), materials.rustMetal));
  sampleTray.position.set(-0.3, 0.83, 0.08);
  bench.add(sampleTray);
  for (let sample = 0; sample < 5; sample += 1) {
    const angle = sample * 2.4;
    const chip = shadowed(new Mesh(new SphereGeometry(0.035 + (sample % 2) * 0.012, 7, 5), sample % 2 ? materials.ore : materials.clay));
    chip.position.set(-0.3 + Math.cos(angle) * 0.11, 0.88, 0.08 + Math.sin(angle) * 0.1);
    bench.add(chip);
  }

  const dial = new Group();
  dial.name = 'research-comparison-dial';
  dial.position.set(0.28, 0.88, 0.1);
  const dialRing = shadowed(new Mesh(new TorusGeometry(0.18, 0.025, 7, 24), materials.metal));
  dialRing.rotation.x = Math.PI / 2;
  const dialHub = shadowed(new Mesh(new CylinderGeometry(0.045, 0.045, 0.075, 10), materials.rustMetal));
  const dialNeedle = shadowed(new Mesh(new BoxGeometry(0.025, 0.05, 0.16), materials.metal));
  dialNeedle.position.z = -0.065;
  dial.add(dialRing, dialHub, dialNeedle);
  bench.add(dial);

  const lensPivot = new Group();
  lensPivot.position.set(-0.02, 0.94, 0.03);
  lensPivot.rotation.z = -0.32;
  const arm = shadowed(new Mesh(new CylinderGeometry(0.018, 0.018, 0.46, 7), materials.metal));
  arm.rotation.z = Math.PI / 2;
  arm.position.x = -0.2;
  const lensRing = shadowed(new Mesh(new TorusGeometry(0.13, 0.018, 7, 24), materials.metal));
  lensRing.position.x = -0.43;
  lensRing.rotation.y = Math.PI / 2;
  const lens = new Mesh(
    new CylinderGeometry(0.115, 0.115, 0.012, 24),
    new MeshPhysicalMaterial({ color: 0x9ad8d6, transmission: 0.45, transparent: true, opacity: 0.4, roughness: 0.12 }),
  );
  lens.position.x = -0.43;
  lens.rotation.z = Math.PI / 2;
  lensPivot.add(arm, lensRing, lens);
  bench.add(lensPivot);

  const indicator = new MeshBasicMaterial({ color: 0x55d7be, transparent: true, opacity: 0.42 });
  const indicatorMesh = new Mesh(new SphereGeometry(0.035, 10, 7), indicator);
  indicatorMesh.position.set(0.47, 0.84, -0.2);
  bench.add(indicatorMesh);

  const highlight = createHighlight(0.7);
  bench.add(highlight);
  bench.userData.researchBenchVisuals = { dial, page, indicator, highlight } satisfies ResearchBenchVisuals;
  return bench;
}

export function createDryingRackModel(materials: MaterialLibrary): Group {
  const rack = new Group();
  rack.name = 'refractory-brick-drying-rack';
  const mat = shadowed(new Mesh(new RoundedBoxGeometry(0.94, 0.07, 0.72, 3, 0.025), materials.wovenFiber));
  mat.position.y = 0.15;
  rack.add(mat);
  for (const x of [-0.48, 0.48]) {
    const rail = shadowed(new Mesh(new CylinderGeometry(0.035, 0.045, 0.76, 7), materials.darkWood));
    rail.position.set(x, 0.19, 0);
    rail.rotation.x = Math.PI / 2;
    rack.add(rail);
  }
  for (const z of [-0.34, 0.34]) {
    const tie = shadowed(new Mesh(new CylinderGeometry(0.018, 0.018, 1.02, 6), materials.rope));
    tie.position.set(0, 0.2, z);
    tie.rotation.z = Math.PI / 2;
    rack.add(tie);
  }

  const bricks: Mesh<BoxGeometry, MeshStandardMaterial>[] = [];
  const brickGeometry = new BoxGeometry(0.39, 0.17, 0.27, 3, 2, 2);
  const positions = [
    [-0.23, 0.31, -0.18],
    [0.23, 0.31, -0.18],
    [-0.23, 0.31, 0.18],
    [0.23, 0.31, 0.18],
  ] as const;
  positions.forEach(([x, y, z], index) => {
    const material = materials.refractoryClay.clone();
    material.color.setHex(0x8f665a);
    material.roughness = 0.7;
    const brick = shadowed(new Mesh(brickGeometry, material));
    brick.position.set(x, y + (index % 2) * 0.008, z);
    brick.rotation.y = (index - 1.5) * 0.018;
    brick.visible = false;
    bricks.push(brick);
    rack.add(brick);
  });
  const highlight = createHighlight(0.64);
  rack.add(highlight);
  rack.userData.dryingRackVisuals = { bricks, highlight } satisfies DryingRackVisuals;
  return rack;
}

function createFurnaceFire(): Pick<SmelterVisuals, 'fire' | 'light' | 'smoke' | 'sparks' | 'heatGlow'> {
  const fire = new Group();
  fire.name = 'smelter-fire';
  const flameGeometry = new SphereGeometry(0.12, 10, 7);
  [0xffd45b, 0xff8a3f, 0xe95032, 0xffb44a, 0xff7041].forEach((color, index) => {
    const flame = new Mesh(
      flameGeometry,
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false, blending: AdditiveBlending }),
    );
    flame.position.set((index - 2) * 0.07, 0.42 + (index % 2) * 0.06, 0.31);
    flame.scale.set(0.78, 1.15 + (index % 3) * 0.25, 0.72);
    flame.userData.phase = index * 1.17;
    fire.add(flame);
  });
  const heatGlow = new MeshBasicMaterial({ color: 0xff7b41, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
  const glow = new Mesh(new PlaneGeometry(0.44, 0.34), heatGlow);
  glow.position.set(0, 0.43, 0.492);
  fire.add(glow);
  const light = new PointLight(0xff7a42, 0, 4.5, 2.1);
  light.position.set(0, 0.54, 0.42);
  fire.add(light);

  const smoke: Mesh[] = [];
  for (let index = 0; index < 6; index += 1) {
    const puff = new Mesh(
      new SphereGeometry(0.12 + index * 0.018, 8, 6),
      new MeshBasicMaterial({ color: 0x626660, transparent: true, opacity: 0, depthWrite: false }),
    );
    puff.userData.phase = index / 6;
    smoke.push(puff);
  }
  const sparks: Mesh[] = [];
  for (let index = 0; index < 9; index += 1) {
    const spark = new Mesh(
      new SphereGeometry(0.012 + (index % 3) * 0.004, 5, 4),
      new MeshBasicMaterial({ color: index % 2 ? 0xffc85b : 0xff7542, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    );
    spark.userData.phase = index / 9;
    sparks.push(spark);
  }
  return { fire, light, smoke, sparks, heatGlow };
}

export function createSmelterModel(materials: MaterialLibrary): Group {
  const smelter = new Group();
  smelter.name = 'return-tide-smelter';
  const base = shadowed(new Mesh(new CylinderGeometry(0.58, 0.66, 0.18, 14), materials.refractoryClay));
  base.position.y = 0.18;
  smelter.add(base);

  const brickGeometry = new RoundedBoxGeometry(0.31, 0.22, 0.2, 2, 0.025);
  for (let tier = 0; tier < 4; tier += 1) {
    const count = tier === 3 ? 8 : 10;
    const radius = 0.47 - tier * 0.018;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + (tier % 2) * 0.16;
      if (tier < 2 && Math.abs(Math.sin(angle)) < 0.33 && Math.cos(angle) > 0) continue;
      const brick = shadowed(new Mesh(brickGeometry, materials.refractoryClay));
      brick.position.set(Math.sin(angle) * radius, 0.38 + tier * 0.2, Math.cos(angle) * radius);
      brick.rotation.y = angle;
      brick.scale.x = count === 8 ? 1.12 : 0.96;
      smelter.add(brick);
    }
  }
  for (const y of [0.33, 0.73, 1.08]) {
    const band = shadowed(new Mesh(new TorusGeometry(0.5 - y * 0.025, 0.025, 7, 34), materials.rustMetal));
    band.position.y = y;
    band.rotation.x = Math.PI / 2;
    smelter.add(band);
  }

  const chimney = shadowed(new Mesh(new CylinderGeometry(0.24, 0.31, 0.58, 10), materials.rustMetal));
  chimney.position.set(-0.14, 1.34, -0.06);
  chimney.rotation.z = -0.035;
  const cap = shadowed(new Mesh(new ConeGeometry(0.36, 0.18, 10, 1, true), materials.rustMetal));
  cap.position.set(-0.14, 1.68, -0.06);
  smelter.add(chimney, cap);

  const opening = new Mesh(new PlaneGeometry(0.43, 0.38), new MeshBasicMaterial({ color: 0x160f0d }));
  opening.position.set(0, 0.45, 0.485);
  smelter.add(opening);
  const door = new Group();
  door.name = 'smelter-door';
  door.position.set(-0.25, 0.45, 0.51);
  const plate = shadowed(new Mesh(new RoundedBoxGeometry(0.43, 0.38, 0.055, 3, 0.04), materials.rustMetal));
  plate.position.x = 0.22;
  const vent = new Mesh(new TorusGeometry(0.09, 0.018, 6, 18), materials.metal);
  vent.position.set(0.22, 0, 0.04);
  const handle = new Mesh(new TorusGeometry(0.065, 0.014, 6, 16, Math.PI), materials.metal);
  handle.position.set(0.35, 0.02, 0.06);
  handle.rotation.z = -Math.PI / 2;
  door.add(plate, vent, handle);
  smelter.add(door);

  const crucible = new Group();
  crucible.name = 'smelter-crucible';
  crucible.position.set(0, 0.87, 0.02);
  const bowl = shadowed(new Mesh(new CylinderGeometry(0.23, 0.18, 0.3, 12, 1, true), materials.metal));
  const bowlBottom = shadowed(new Mesh(new CylinderGeometry(0.18, 0.18, 0.04, 12), materials.rustMetal));
  bowlBottom.position.y = -0.15;
  crucible.add(bowl, bowlBottom);
  smelter.add(crucible);
  const ore = shadowed(new Mesh(new SphereGeometry(0.15, 8, 6), materials.ore.clone()));
  ore.scale.set(1.1, 0.65, 0.9);
  ore.position.set(0, 0.93, 0.02);
  ore.visible = false;
  smelter.add(ore);
  const ingotMaterial = materials.metal.clone();
  ingotMaterial.color.setHex(0xb4d0c9);
  ingotMaterial.roughness = 0.36;
  ingotMaterial.transparent = true;
  const ingot = shadowed(new Mesh(new RoundedBoxGeometry(0.34, 0.12, 0.18, 3, 0.025), ingotMaterial));
  ingot.position.set(0, 0.96, 0.03);
  ingot.rotation.y = 0.16;
  ingot.visible = false;
  smelter.add(ingot);

  const fireVisuals = createFurnaceFire();
  smelter.add(fireVisuals.fire);
  fireVisuals.smoke.forEach((puff) => smelter.add(puff));
  fireVisuals.sparks.forEach((spark) => smelter.add(spark));
  const highlight = createHighlight(0.73);
  smelter.add(highlight);
  smelter.userData.smelterVisuals = {
    ...fireVisuals,
    ore,
    ingot,
    crucible,
    door,
    highlight,
  } satisfies SmelterVisuals;
  return smelter;
}
