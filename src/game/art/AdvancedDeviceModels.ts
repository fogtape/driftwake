import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MaterialLibrary } from './Materials';
import { createFishFilletModel, type DeviceModelVisuals } from './ProceduralModels';

function shadowed<T extends Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addFrame(group: Group, materials: MaterialLibrary, width: number, depth: number, height: number): void {
  for (const x of [-width / 2, width / 2]) {
    for (const z of [-depth / 2, depth / 2]) {
      const leg = shadowed(new Mesh(new CylinderGeometry(0.045, 0.06, height, 8), materials.darkWood));
      leg.position.set(x, height / 2, z);
      leg.rotation.z = x * 0.055;
      leg.rotation.x = z * 0.055;
      group.add(leg);
      for (const y of [0.17, height * 0.72]) {
        const binding = shadowed(new Mesh(new TorusGeometry(0.057, 0.009, 5, 14), materials.rope));
        binding.position.set(x, y, z);
        binding.rotation.x = Math.PI / 2;
        group.add(binding);
      }
    }
  }
  for (const z of [-depth / 2, depth / 2]) {
    const rail = shadowed(new Mesh(new BoxGeometry(width + 0.12, 0.065, 0.07), materials.wood[z > 0 ? 1 : 2]));
    rail.position.set(0, height * 0.72, z);
    group.add(rail);
  }
  for (const x of [-width / 2, width / 2]) {
    const rail = shadowed(new Mesh(new BoxGeometry(0.07, 0.065, depth + 0.12), materials.wood[x > 0 ? 2 : 1]));
    rail.position.set(x, height * 0.72, 0);
    group.add(rail);
  }
}

interface DeviceFireVisuals {
  fire: Group;
  light: PointLight;
  puffs: Mesh[];
  embers: Mesh[];
}

function createFireVisuals(): DeviceFireVisuals {
  const fire = new Group();
  fire.name = 'multi-grill-fire';
  const embers: Mesh[] = [];
  for (let index = 0; index < 8; index += 1) {
    const ember = new Mesh(
      new SphereGeometry(0.026 + (index % 3) * 0.006, 6, 4),
      new MeshBasicMaterial({ color: index % 2 ? 0xe56c32 : 0x8c3025 }),
    );
    ember.position.set((index % 4 - 1.5) * 0.15, 0.02 + (index % 2) * 0.02, (Math.floor(index / 4) - 0.5) * 0.18);
    embers.push(ember);
    fire.add(ember);
  }
  for (let index = 0; index < 7; index += 1) {
    const flame = new Mesh(
      new SphereGeometry(0.07, 7, 5),
      new MeshBasicMaterial({ color: index % 2 ? 0xffa63c : 0xe75a2f, transparent: true, opacity: 0.68 }),
    );
    flame.scale.set(0.7, 1.55 + (index % 3) * 0.32, 0.72);
    flame.position.set((index - 3) * 0.12, 0.09 + (index % 2) * 0.035, Math.sin(index * 2.1) * 0.08);
    flame.userData.phase = index * 0.83;
    flame.userData.baseX = flame.position.x;
    fire.add(flame);
  }
  const light = new PointLight(0xff8b3f, 0, 3.2, 2);
  light.position.y = 0.32;
  fire.add(light);

  const puffs: Mesh[] = [];
  for (let index = 0; index < 6; index += 1) {
    const puff = new Mesh(
      new SphereGeometry(0.12, 7, 5),
      new MeshBasicMaterial({ color: 0x858783, transparent: true, opacity: 0, depthWrite: false }),
    );
    puff.userData.phase = index / 6;
    puffs.push(puff);
  }
  return { fire, light, puffs, embers };
}

function cloneFood(materials: MaterialLibrary): {
  food: Group;
  meshes: Mesh<BufferGeometry, MeshStandardMaterial>[];
} {
  const food = createFishFilletModel(materials);
  const meshes: Mesh<BufferGeometry, MeshStandardMaterial>[] = [];
  food.traverse((object) => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
    meshes.push(object as Mesh<BufferGeometry, MeshStandardMaterial>);
  });
  return { food, meshes };
}

export function createSolarPurifierModel(materials: MaterialLibrary): Group {
  const purifier = new Group();
  purifier.name = 'saltglass-five-cell-purifier';
  addFrame(purifier, materials, 1.02, 0.78, 0.88);

  const base = shadowed(new Mesh(new RoundedBoxGeometry(1.04, 0.16, 0.72, 4, 0.06), materials.navigationAlloy));
  base.position.y = 0.25;
  purifier.add(base);
  const basin = shadowed(new Mesh(new RoundedBoxGeometry(0.92, 0.15, 0.58, 4, 0.05), materials.saltEtchedPolymer));
  basin.position.y = 0.36;
  purifier.add(basin);

  const collectorPivot = new Group();
  collectorPivot.name = 'solar-collector-pivot';
  collectorPivot.position.set(0, 0.68, -0.22);
  collectorPivot.rotation.x = -0.48;
  const collector = shadowed(new Mesh(new RoundedBoxGeometry(1.12, 0.055, 0.72, 5, 0.035), materials.saltglassCollector));
  collectorPivot.add(collector);
  for (const x of [-0.54, 0, 0.54]) {
    const spar = shadowed(new Mesh(new BoxGeometry(0.035, 0.085, 0.76), materials.navigationAlloy));
    spar.position.set(x, 0.012, 0);
    collectorPivot.add(spar);
  }
  for (const z of [-0.35, 0.35]) {
    const rim = shadowed(new Mesh(new BoxGeometry(1.15, 0.09, 0.035), materials.navigationAlloy));
    rim.position.set(0, 0.012, z);
    collectorPivot.add(rim);
  }
  purifier.add(collectorPivot);

  for (const x of [-0.46, 0.46]) {
    const stay = shadowed(new Mesh(new CylinderGeometry(0.016, 0.021, 0.65, 7), materials.navigationAlloy));
    stay.position.set(x, 0.65, -0.33);
    stay.rotation.x = -0.48;
    purifier.add(stay);
  }

  const waterCells: Mesh[] = [];
  const waterReadyMarkers: Mesh[] = [];
  const glassMaterial = new MeshPhysicalMaterial({
    color: 0xa8d8d6,
    roughness: 0.24,
    transparent: true,
    opacity: 0.54,
    transmission: 0.18,
    thickness: 0.04,
  });
  for (let index = 0; index < 5; index += 1) {
    const x = (index - 2) * 0.19;
    const cell = new Group();
    cell.position.set(x, 0.45, 0.19);
    const wall = new Mesh(new CylinderGeometry(0.082, 0.072, 0.24, 12, 1, true), glassMaterial);
    const rim = shadowed(new Mesh(new TorusGeometry(0.082, 0.009, 5, 16), materials.navigationAlloy));
    rim.position.y = 0.12;
    rim.rotation.x = Math.PI / 2;
    const water = new Mesh(
      new CylinderGeometry(0.069, 0.069, 0.012, 14),
      new MeshPhysicalMaterial({ color: 0x4fc6cf, roughness: 0.12, transparent: true, opacity: 0.84 }),
    );
    water.position.y = -0.07;
    water.visible = false;
    const marker = new Mesh(
      new SphereGeometry(0.019, 7, 5),
      new MeshStandardMaterial({ color: 0x5d817b, emissive: 0x000000, roughness: 0.36 }),
    );
    marker.position.set(0, 0.15, 0.075);
    marker.visible = false;
    waterCells.push(water);
    waterReadyMarkers.push(marker);
    cell.add(wall, rim, water, marker);
    purifier.add(cell);
  }

  const manifold = shadowed(new Mesh(new CylinderGeometry(0.028, 0.028, 0.96, 8), materials.navigationAlloy));
  manifold.rotation.z = Math.PI / 2;
  manifold.position.set(0, 0.69, 0.16);
  purifier.add(manifold);
  for (let index = 0; index < 5; index += 1) {
    const x = (index - 2) * 0.19;
    const curve = new CatmullRomCurve3([
      new Vector3(x, 0.69, 0.16),
      new Vector3(x, 0.62, 0.2),
      new Vector3(x, 0.58, 0.2),
    ]);
    purifier.add(shadowed(new Mesh(new TubeGeometry(curve, 8, 0.009, 5, false), materials.navigationAlloy)));
  }

  const puffs: Mesh[] = [];
  for (let index = 0; index < 5; index += 1) {
    const puff = new Mesh(
      new SphereGeometry(0.09, 7, 5),
      new MeshBasicMaterial({ color: 0xd8eee8, transparent: true, opacity: 0, depthWrite: false }),
    );
    puff.userData.phase = index / 5;
    purifier.add(puff);
    puffs.push(puff);
  }
  const drip = new Mesh(
    new SphereGeometry(0.018, 7, 5),
    new MeshPhysicalMaterial({ color: 0x7ee0e2, roughness: 0.08, transparent: true, opacity: 0.9 }),
  );
  drip.visible = false;
  purifier.add(drip);

  purifier.userData.deviceVisuals = {
    puffs,
    drip,
    collectorPivot,
    waterCells,
    waterReadyMarkers,
  } satisfies DeviceModelVisuals;
  return purifier;
}

export function createTripleGrillModel(materials: MaterialLibrary): Group {
  const grill = new Group();
  grill.name = 'three-slot-smokefin-grill';
  addFrame(grill, materials, 1.12, 0.72, 0.54);
  const fireVisuals = createFireVisuals();
  fireVisuals.fire.position.set(0, 0.29, 0);
  grill.add(fireVisuals.fire);
  fireVisuals.puffs.forEach((puff) => grill.add(puff));

  const firebox = shadowed(new Mesh(new RoundedBoxGeometry(1.08, 0.26, 0.64, 4, 0.07), materials.refractoryClay));
  firebox.position.y = 0.29;
  grill.add(firebox);
  const fireMouth = shadowed(new Mesh(new RoundedBoxGeometry(0.58, 0.16, 0.055, 3, 0.025), materials.saltfireIron));
  fireMouth.name = 'triple-grill-fire-mouth';
  fireMouth.position.set(0, 0.28, 0.33);
  grill.add(fireMouth);

  const top = shadowed(new Mesh(new RoundedBoxGeometry(1.16, 0.08, 0.68, 4, 0.035), materials.navigationAlloy));
  top.position.y = 0.48;
  grill.add(top);
  for (let index = -6; index <= 6; index += 1) {
    const rod = shadowed(new Mesh(new CylinderGeometry(0.009, 0.009, 0.6, 6), materials.saltfireIron));
    rod.name = `triple-grill-grate-${index}`;
    rod.position.set(index * 0.082, 0.535, 0);
    rod.rotation.x = Math.PI / 2;
    grill.add(rod);
  }
  for (const x of [-0.56, -0.19, 0.19, 0.56]) {
    const divider = shadowed(new Mesh(new CylinderGeometry(0.014, 0.014, 0.67, 7), materials.navigationAlloy));
    divider.position.set(x, 0.54, 0);
    divider.rotation.x = Math.PI / 2;
    grill.add(divider);
  }

  const foodSlots: Group[] = [];
  const foodSlotMeshes: Mesh<BufferGeometry, MeshStandardMaterial>[][] = [];
  for (let index = 0; index < 3; index += 1) {
    const { food, meshes } = cloneFood(materials);
    food.name = `triple-grill-food-${index}`;
    food.position.set((index - 1) * 0.36, 0.62, 0);
    food.rotation.y = Math.PI / 2;
    food.scale.setScalar(0.39);
    food.visible = false;
    foodSlots.push(food);
    foodSlotMeshes.push(meshes);
    grill.add(food);
  }

  const fuelBars: Mesh[] = [];
  for (let index = 0; index < 4; index += 1) {
    const bar = new Mesh(
      new BoxGeometry(0.09, 0.035, 0.025),
      new MeshStandardMaterial({ color: 0x5f6f69, emissive: 0x000000, roughness: 0.5, metalness: 0.45 }),
    );
    bar.position.set(-0.16 + index * 0.105, 0.18, 0.37);
    fuelBars.push(bar);
    grill.add(bar);
  }
  const handle = shadowed(new Mesh(new TorusGeometry(0.27, 0.025, 7, 24, Math.PI), materials.navigationAlloy));
  handle.position.set(0, 0.27, -0.38);
  handle.rotation.x = Math.PI / 2;
  grill.add(handle);

  grill.userData.deviceVisuals = {
    ...fireVisuals,
    foodSlots,
    foodSlotMeshes,
    fuelBars,
  } satisfies DeviceModelVisuals;
  return grill;
}

export function createLockerModel(materials: MaterialLibrary): Group {
  const locker = new Group();
  locker.name = 'dry-hold-eight-slot-locker';
  const plinth = shadowed(new Mesh(new RoundedBoxGeometry(1.06, 0.12, 0.66, 4, 0.045), materials.navigationAlloy));
  plinth.position.y = 0.08;
  locker.add(plinth);
  const body = shadowed(new Mesh(new RoundedBoxGeometry(0.98, 0.72, 0.6, 5, 0.065), materials.wood[1]));
  body.position.y = 0.49;
  locker.add(body);

  for (const x of [-0.46, 0.46]) {
    const upright = shadowed(new Mesh(new BoxGeometry(0.065, 0.76, 0.64), materials.navigationAlloy));
    upright.position.set(x, 0.49, 0);
    locker.add(upright);
  }
  for (const y of [0.16, 0.82]) {
    const band = shadowed(new Mesh(new BoxGeometry(1.02, 0.055, 0.64), materials.navigationAlloy));
    band.position.set(0, y, 0);
    locker.add(band);
  }

  const frontSeal = shadowed(new Mesh(new RoundedBoxGeometry(0.82, 0.55, 0.045, 4, 0.035), materials.sealedCanvas));
  frontSeal.position.set(0, 0.51, 0.315);
  locker.add(frontSeal);
  for (const x of [-0.3, 0, 0.3]) {
    const strap = shadowed(new Mesh(new BoxGeometry(0.035, 0.58, 0.025), materials.rope));
    strap.position.set(x, 0.51, 0.345);
    locker.add(strap);
  }

  const lid = new Group();
  lid.name = 'locker-lid-pivot';
  lid.position.set(0, 0.84, -0.27);
  const lidTop = shadowed(new Mesh(new RoundedBoxGeometry(1.02, 0.1, 0.62, 4, 0.045), materials.sealedCanvas));
  lidTop.position.z = 0.28;
  lid.add(lidTop);
  for (const x of [-0.32, 0.32]) {
    const lidBand = shadowed(new Mesh(new BoxGeometry(0.05, 0.13, 0.65), materials.navigationAlloy));
    lidBand.position.set(x, 0, 0.28);
    lid.add(lidBand);
  }
  locker.add(lid);

  for (const x of [-0.3, 0.3]) {
    const hinge = shadowed(new Mesh(new CylinderGeometry(0.035, 0.035, 0.18, 9), materials.navigationAlloy));
    hinge.position.set(x, 0.84, -0.31);
    hinge.rotation.z = Math.PI / 2;
    locker.add(hinge);
    const latch = shadowed(new Mesh(new RoundedBoxGeometry(0.12, 0.2, 0.055, 3, 0.018), materials.navigationAlloy));
    latch.position.set(x, 0.64, 0.35);
    locker.add(latch);
  }
  const handle = shadowed(new Mesh(new TorusGeometry(0.18, 0.022, 7, 22, Math.PI), materials.navigationAlloy));
  handle.position.set(0, 0.73, 0.38);
  handle.rotation.x = Math.PI / 2;
  locker.add(handle);

  const storageMarkers: Mesh[] = [];
  for (let index = 0; index < 8; index += 1) {
    const marker = new Mesh(
      new BoxGeometry(0.025, 0.052, 0.02),
      new MeshStandardMaterial({ color: 0x536d69, emissive: 0x000000, roughness: 0.45, metalness: 0.52 }),
    );
    marker.position.set(-0.43 + index * 0.123, 0.24, 0.355);
    marker.scale.y = 0.5;
    storageMarkers.push(marker);
    locker.add(marker);
  }

  const sidePatch = shadowed(new Mesh(new PlaneGeometry(0.42, 0.28), materials.sealedCanvas));
  sidePatch.position.set(0.505, 0.48, 0);
  sidePatch.rotation.y = Math.PI / 2;
  locker.add(sidePatch);

  locker.userData.deviceVisuals = { lid, storageMarkers } satisfies DeviceModelVisuals;
  return locker;
}
