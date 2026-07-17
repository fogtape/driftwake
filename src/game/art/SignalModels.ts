import {
  AdditiveBlending,
  BoxGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MaterialLibrary } from './Materials';

export interface ReceiverModelVisuals {
  kind: 'receiver';
  highlight: Mesh;
  screen: Mesh;
  screenMaterial: MeshStandardMaterial;
  sweep: Group;
  blips: Mesh[];
  powerLight: Mesh;
  powerMaterial: MeshStandardMaterial;
  arrayLights: Mesh[];
  chargeBars: Mesh[];
  tuningDrums: Group[];
  tuningNeedle: Group;
}

export interface AntennaModelVisuals {
  kind: 'antenna';
  highlight: Mesh;
  mastPivots: Group[];
  phaseLight: Mesh;
  phaseMaterial: MeshStandardMaterial;
  signalRings: Mesh[];
}

export interface SignalBeaconVisuals {
  pulseRings: Mesh[];
  beaconLight: Mesh;
  beaconMaterial: MeshStandardMaterial;
  rotor: Group;
  floats: Group[];
}

export type SignalModelVisuals = ReceiverModelVisuals | AntennaModelVisuals;

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
  const ring = new Mesh(new TorusGeometry(radius, 0.022, 6, 32), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.065;
  ring.visible = false;
  ring.renderOrder = 3;
  return ring;
}

function cable(group: Group, materials: MaterialLibrary, points: Vector3[], radius = 0.009): void {
  const curve = new CatmullRomCurve3(points);
  group.add(shadowed(new Mesh(new TubeGeometry(curve, 18, radius, 5, false), materials.rope)));
}

function indicator(color: number): { mesh: Mesh; material: MeshStandardMaterial } {
  const material = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.08,
    roughness: 0.3,
    metalness: 0.04,
  });
  return {
    mesh: new Mesh(new SphereGeometry(0.027, 10, 7), material),
    material,
  };
}

export function createReceiverModel(materials: MaterialLibrary): Group {
  const receiver = new Group();
  receiver.name = 'tide-listener-receiver';

  const base = shadowed(new Mesh(new RoundedBoxGeometry(1.02, 0.12, 0.76, 4, 0.035), materials.wood[2]));
  base.position.y = 0.11;
  receiver.add(base);
  for (const x of [-0.43, 0.43]) {
    for (const z of [-0.29, 0.29]) {
      const foot = shadowed(new Mesh(new CylinderGeometry(0.047, 0.06, 0.22, 8), materials.darkWood));
      foot.position.set(x, 0.13, z);
      foot.rotation.z = x * 0.06;
      foot.rotation.x = z * 0.06;
      receiver.add(foot);
      const binding = shadowed(new Mesh(new TorusGeometry(0.054, 0.009, 5, 14), materials.rope));
      binding.position.set(x, 0.18, z);
      binding.rotation.x = Math.PI / 2;
      receiver.add(binding);
    }
  }

  const cabinet = shadowed(new Mesh(new RoundedBoxGeometry(0.94, 0.48, 0.62, 5, 0.055), materials.signalLaminate));
  cabinet.position.y = 0.43;
  receiver.add(cabinet);
  const rearPlate = shadowed(new Mesh(new RoundedBoxGeometry(0.82, 0.31, 0.06, 4, 0.025), materials.navigationAlloy));
  rearPlate.position.set(0, 0.48, -0.325);
  receiver.add(rearPlate);
  for (const x of [-0.39, 0.39]) {
    for (const y of [0.28, 0.58]) {
      const screw = shadowed(new Mesh(new CylinderGeometry(0.021, 0.021, 0.018, 8), materials.metal));
      screw.position.set(x, y, 0.322);
      screw.rotation.x = Math.PI / 2;
      receiver.add(screw);
    }
  }

  const panel = new Group();
  panel.name = 'receiver-scan-panel';
  panel.position.set(0, 0.72, 0.05);
  panel.rotation.x = -0.48;
  const panelShell = shadowed(new Mesh(new RoundedBoxGeometry(0.86, 0.54, 0.12, 5, 0.045), materials.signalLaminate));
  panel.add(panelShell);
  const bezel = shadowed(new Mesh(new RoundedBoxGeometry(0.6, 0.39, 0.055, 4, 0.035), materials.navigationAlloy));
  bezel.position.set(-0.065, 0.025, 0.083);
  panel.add(bezel);

  const screenMaterial = materials.phosphorGlass.clone();
  screenMaterial.emissive.setHex(0x0c3a32);
  screenMaterial.emissiveIntensity = 0.16;
  const screen = new Mesh(new RoundedBoxGeometry(0.53, 0.325, 0.028, 4, 0.025), screenMaterial);
  screen.position.set(-0.065, 0.025, 0.119);
  panel.add(screen);

  const scanMaterial = new MeshBasicMaterial({
    color: 0x79e1bd,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  for (const radius of [0.075, 0.14, 0.205]) {
    const ring = new Mesh(new TorusGeometry(radius, 0.0035, 4, 42), scanMaterial);
    ring.position.set(-0.065, 0.025, 0.139);
    panel.add(ring);
  }
  for (let tick = 0; tick < 24; tick += 1) {
    const angle = tick / 24 * Math.PI * 2;
    const length = tick % 3 === 0 ? 0.025 : 0.014;
    const mark = new Mesh(new BoxGeometry(length, 0.004, 0.004), scanMaterial);
    mark.position.set(-0.065 + Math.cos(angle) * 0.224, 0.025 + Math.sin(angle) * 0.224, 0.139);
    mark.rotation.z = angle;
    panel.add(mark);
  }
  const sweep = new Group();
  sweep.position.set(-0.065, 0.025, 0.142);
  const beam = new Mesh(new PlaneGeometry(0.205, 0.038), new MeshBasicMaterial({
    color: 0x8bf3c7,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  }));
  beam.position.x = 0.102;
  sweep.add(beam);
  const sweepNeedle = new Mesh(new BoxGeometry(0.205, 0.007, 0.006), scanMaterial);
  sweepNeedle.position.x = 0.102;
  sweep.add(sweepNeedle);
  panel.add(sweep);

  const blips: Mesh[] = [];
  const blipMaterial = new MeshBasicMaterial({
    color: 0xc9ffe0,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  for (const [x, y] of [[0.12, 0.07], [-0.08, 0.13], [0.04, -0.15]] as const) {
    const blip = new Mesh(new SphereGeometry(0.011, 8, 6), blipMaterial);
    blip.scale.z = 0.3;
    blip.position.set(-0.065 + x, 0.025 + y, 0.147);
    blips.push(blip);
    panel.add(blip);
  }

  const power = indicator(0x72d4b3);
  power.mesh.position.set(0.35, 0.15, 0.12);
  panel.add(power.mesh);
  const arrayLights: Mesh[] = [];
  for (let index = 0; index < 3; index += 1) {
    const lamp = indicator(index === 2 ? 0xefc35c : 0x72d4b3);
    lamp.mesh.position.set(0.305 + index * 0.045, 0.07, 0.12);
    lamp.mesh.scale.setScalar(0.72);
    arrayLights.push(lamp.mesh);
    panel.add(lamp.mesh);
  }

  const tuningDrums: Group[] = [];
  for (let index = 0; index < 3; index += 1) {
    const drum = new Group();
    drum.position.set(0.31 + (index % 2) * 0.08, -0.06 - Math.floor(index / 2) * 0.09, 0.105);
    const core = shadowed(new Mesh(new CylinderGeometry(0.034, 0.034, 0.056, 14), materials.navigationAlloy));
    core.rotation.x = Math.PI / 2;
    drum.add(core);
    for (let ridge = 0; ridge < 10; ridge += 1) {
      const tooth = shadowed(new Mesh(new BoxGeometry(0.008, 0.009, 0.062), materials.darkWood));
      const angle = ridge / 10 * Math.PI * 2;
      tooth.position.set(Math.cos(angle) * 0.036, Math.sin(angle) * 0.036, 0);
      tooth.rotation.z = angle;
      drum.add(tooth);
    }
    tuningDrums.push(drum);
    panel.add(drum);
  }
  const tuningNeedle = new Group();
  tuningNeedle.position.set(0.34, -0.18, 0.12);
  const needle = new Mesh(new BoxGeometry(0.13, 0.009, 0.009), scanMaterial);
  needle.position.x = 0.065;
  tuningNeedle.add(needle);
  panel.add(tuningNeedle);
  receiver.add(panel);

  const tray = new Group();
  tray.position.set(-0.31, 0.36, 0.34);
  const trayCase = shadowed(new Mesh(new RoundedBoxGeometry(0.31, 0.12, 0.12, 4, 0.022), materials.navigationAlloy));
  tray.add(trayCase);
  const chargeBars: Mesh[] = [];
  for (let index = 0; index < 6; index += 1) {
    const material = new MeshStandardMaterial({
      color: index < 2 ? 0xefc35c : 0x72d4b3,
      emissive: index < 2 ? 0x5f4616 : 0x174d40,
      emissiveIntensity: 0.55,
      roughness: 0.44,
    });
    const bar = new Mesh(new BoxGeometry(0.032, 0.052, 0.016), material);
    bar.position.set(-0.105 + index * 0.042, 0, 0.069);
    chargeBars.push(bar);
    tray.add(bar);
  }
  receiver.add(tray);

  const loopFrame = new Group();
  loopFrame.position.set(0.28, 0.88, -0.19);
  loopFrame.rotation.y = -0.18;
  for (const radius of [0.23, 0.195, 0.16]) {
    const coil = shadowed(new Mesh(new TorusGeometry(radius, 0.011, 6, 36), materials.navigationAlloy));
    coil.rotation.y = Math.PI / 2;
    loopFrame.add(coil);
  }
  for (const side of [-1, 1]) {
    const brace = shadowed(new Mesh(new CylinderGeometry(0.018, 0.024, 0.43, 7), materials.darkWood));
    brace.position.set(0, -0.19, side * 0.14);
    brace.rotation.z = side * 0.2;
    loopFrame.add(brace);
  }
  receiver.add(loopFrame);
  cable(receiver, materials, [new Vector3(0.28, 0.75, -0.22), new Vector3(0.47, 0.58, -0.29), new Vector3(0.39, 0.42, -0.31)]);
  cable(receiver, materials, [new Vector3(-0.4, 0.37, 0.32), new Vector3(-0.5, 0.24, 0.22), new Vector3(-0.43, 0.16, 0.07)]);

  const highlight = createHighlight(0.58);
  receiver.add(highlight);
  receiver.userData.navigationVisuals = {
    kind: 'receiver',
    highlight,
    screen,
    screenMaterial,
    sweep,
    blips,
    powerLight: power.mesh,
    powerMaterial: power.material,
    arrayLights,
    chargeBars,
    tuningDrums,
    tuningNeedle,
  } satisfies ReceiverModelVisuals;
  return receiver;
}

export function createAntennaModel(materials: MaterialLibrary): Group {
  const antenna = new Group();
  antenna.name = 'twin-mast-direction-array';
  const base = shadowed(new Mesh(new RoundedBoxGeometry(0.92, 0.13, 0.66, 4, 0.035), materials.wood[1]));
  base.position.y = 0.1;
  antenna.add(base);
  const phaseBox = shadowed(new Mesh(new RoundedBoxGeometry(0.5, 0.25, 0.32, 4, 0.04), materials.signalLaminate));
  phaseBox.position.set(0, 0.31, 0.02);
  antenna.add(phaseBox);
  const plate = shadowed(new Mesh(new BoxGeometry(0.38, 0.12, 0.035), materials.navigationAlloy));
  plate.position.set(0, 0.32, 0.19);
  antenna.add(plate);
  const phase = indicator(0x72d4b3);
  phase.mesh.position.set(0, 0.32, 0.215);
  antenna.add(phase.mesh);

  const mastPivots: Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(side * 0.3, 0.16, -0.05);
    const mast = shadowed(new Mesh(new CylinderGeometry(0.026, 0.042, 1.78, 9), materials.navigationAlloy));
    mast.position.y = 0.89;
    pivot.add(mast);
    for (const y of [0.38, 0.78, 1.18, 1.55]) {
      const insulator = shadowed(new Mesh(new CylinderGeometry(0.052, 0.052, 0.055, 10), materials.phosphorGlass));
      insulator.position.y = y;
      pivot.add(insulator);
      const crossbar = shadowed(new Mesh(new CylinderGeometry(0.012, 0.012, 0.48 - y * 0.08, 7), materials.navigationAlloy));
      crossbar.position.y = y;
      crossbar.rotation.z = Math.PI / 2;
      pivot.add(crossbar);
      for (const end of [-1, 1]) {
        const cap = shadowed(new Mesh(new SphereGeometry(0.024, 8, 5), materials.metal));
        cap.position.set(end * (0.22 - y * 0.04), y, 0);
        pivot.add(cap);
      }
    }
    for (const [radius, y] of [[0.17, 0.72], [0.13, 1.12], [0.09, 1.47]] as const) {
      const loop = shadowed(new Mesh(new TorusGeometry(radius, 0.009, 6, 30), materials.navigationAlloy));
      loop.position.y = y;
      loop.rotation.y = Math.PI / 2;
      pivot.add(loop);
    }
    const crown = shadowed(new Mesh(new ConeGeometry(0.065, 0.15, 8), materials.navigationAlloy));
    crown.position.y = 1.85;
    pivot.add(crown);
    mastPivots.push(pivot);
    antenna.add(pivot);
  }

  for (const x of [-0.43, 0.43]) {
    cable(antenna, materials, [new Vector3(x > 0 ? 0.3 : -0.3, 1.78, -0.05), new Vector3(x, 0.94, 0.2), new Vector3(x, 0.14, 0.28)], 0.007);
    cable(antenna, materials, [new Vector3(x > 0 ? 0.3 : -0.3, 1.44, -0.05), new Vector3(x, 0.78, -0.23), new Vector3(x, 0.14, -0.28)], 0.007);
  }
  cable(antenna, materials, [new Vector3(-0.3, 0.5, -0.05), new Vector3(0, 0.43, -0.02), new Vector3(0.3, 0.5, -0.05)], 0.01);

  const signalRings: Mesh[] = [];
  for (let index = 0; index < 3; index += 1) {
    const ring = new Mesh(
      new TorusGeometry(0.42 + index * 0.18, 0.008, 5, 40),
      new MeshBasicMaterial({
        color: 0x7ce1c1,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    ring.position.y = 1.23;
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    signalRings.push(ring);
    antenna.add(ring);
  }

  const highlight = createHighlight(0.56);
  antenna.add(highlight);
  antenna.userData.navigationVisuals = {
    kind: 'antenna',
    highlight,
    mastPivots,
    phaseLight: phase.mesh,
    phaseMaterial: phase.material,
    signalRings,
  } satisfies AntennaModelVisuals;
  return antenna;
}

export function createSignalBeaconModel(materials: MaterialLibrary): Group {
  const beacon = new Group();
  beacon.name = 'signal-relay-beacon';
  const floats: Group[] = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = index / 3 * Math.PI * 2;
    const float = new Group();
    float.position.set(Math.cos(angle) * 1.05, 0, Math.sin(angle) * 1.05);
    float.rotation.y = -angle;
    const pontoon = shadowed(new Mesh(new CylinderGeometry(0.25, 0.3, 1.05, 12), materials.sealedCanvas));
    pontoon.rotation.z = Math.PI / 2;
    float.add(pontoon);
    for (const side of [-0.35, 0.35]) {
      const band = shadowed(new Mesh(new TorusGeometry(0.27, 0.026, 7, 22), materials.navigationAlloy));
      band.position.x = side;
      band.rotation.y = Math.PI / 2;
      float.add(band);
    }
    floats.push(float);
    beacon.add(float);
  }
  const deck = shadowed(new Mesh(new CylinderGeometry(0.82, 0.92, 0.18, 12), materials.signalLaminate));
  deck.position.y = 0.19;
  beacon.add(deck);
  for (let arm = 0; arm < 3; arm += 1) {
    const angle = arm / 3 * Math.PI * 2;
    const brace = shadowed(new Mesh(new BoxGeometry(1.2, 0.08, 0.1), materials.navigationAlloy));
    brace.position.set(Math.cos(angle) * 0.53, 0.24, Math.sin(angle) * 0.53);
    brace.rotation.y = -angle;
    beacon.add(brace);
  }
  const mast = shadowed(new Mesh(new CylinderGeometry(0.055, 0.08, 2.35, 10), materials.navigationAlloy));
  mast.position.y = 1.42;
  beacon.add(mast);
  for (const y of [0.62, 1.05, 1.48]) {
    const collar = shadowed(new Mesh(new TorusGeometry(0.09, 0.018, 6, 20), materials.rustMetal));
    collar.position.y = y;
    collar.rotation.x = Math.PI / 2;
    beacon.add(collar);
  }

  const rotor = new Group();
  rotor.position.y = 1.55;
  for (const side of [-1, 1]) {
    const arm = shadowed(new Mesh(new CylinderGeometry(0.018, 0.024, 0.74, 7), materials.navigationAlloy));
    arm.rotation.z = Math.PI / 2;
    rotor.add(arm);
    const loop = shadowed(new Mesh(new TorusGeometry(0.25, 0.012, 6, 30), materials.navigationAlloy));
    loop.position.x = side * 0.42;
    loop.rotation.y = Math.PI / 2;
    rotor.add(loop);
  }
  beacon.add(rotor);
  const crown = shadowed(new Mesh(new RoundedBoxGeometry(0.34, 0.28, 0.34, 4, 0.04), materials.phosphorGlass));
  crown.position.y = 2.52;
  beacon.add(crown);
  const beaconIndicator = indicator(0xefc35c);
  beaconIndicator.mesh.scale.setScalar(2.1);
  beaconIndicator.mesh.position.y = 2.72;
  beacon.add(beaconIndicator.mesh);

  const pulseRings: Mesh[] = [];
  for (let index = 0; index < 4; index += 1) {
    const ring = new Mesh(
      new TorusGeometry(0.5 + index * 0.22, 0.018, 6, 44),
      new MeshBasicMaterial({
        color: index % 2 ? 0x79e1bd : 0xefc35c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    ring.position.y = 2.55;
    ring.rotation.x = Math.PI / 2;
    pulseRings.push(ring);
    beacon.add(ring);
  }
  beacon.userData.signalBeaconVisuals = {
    pulseRings,
    beaconLight: beaconIndicator.mesh,
    beaconMaterial: beaconIndicator.material,
    rotor,
    floats,
  } satisfies SignalBeaconVisuals;
  beacon.visible = false;
  return beacon;
}
