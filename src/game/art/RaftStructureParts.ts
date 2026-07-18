import type { RaftStructureType } from '../domain/raftStructures';

export type StructurePartGeometry = 'box' | 'cylinder';
export type StructurePartMaterial = 'wood' | 'woodAlt' | 'darkWood' | 'rope' | 'metal' | 'fiber';

export interface StructurePart {
  geometry: StructurePartGeometry;
  material: StructurePartMaterial;
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotation?: readonly [number, number, number];
}

const box = (
  material: StructurePartMaterial,
  position: StructurePart['position'],
  scale: StructurePart['scale'],
  rotation?: StructurePart['rotation'],
): StructurePart => ({ geometry: 'box', material, position, scale, rotation });

const cylinder = (
  material: StructurePartMaterial,
  position: StructurePart['position'],
  scale: StructurePart['scale'],
  rotation?: StructurePart['rotation'],
): StructurePart => ({ geometry: 'cylinder', material, position, scale, rotation });

function wallParts(): StructurePart[] {
  const parts: StructurePart[] = [
    box('darkWood', [-0.64, 1.08, 0], [0.13, 2.16, 0.14]),
    box('darkWood', [0.64, 1.08, 0], [0.13, 2.16, 0.14]),
    box('darkWood', [0, 0.16, 0], [1.38, 0.13, 0.13]),
    box('darkWood', [0, 2.04, 0], [1.38, 0.13, 0.13]),
    box('darkWood', [0, 1.05, -0.055], [1.28, 0.095, 0.09], [0, 0, 0.56]),
  ];
  for (let index = 0; index < 5; index += 1) {
    parts.push(box(
      index % 2 === 0 ? 'wood' : 'woodAlt',
      [-0.46 + index * 0.23, 1.08 + (index % 2 === 0 ? 0.015 : -0.012), 0.02],
      [0.205, 1.72, 0.085],
      [0, 0, (index - 2) * 0.012],
    ));
  }
  for (const x of [-0.64, 0.64]) {
    for (const y of [0.32, 1.84]) {
      parts.push(cylinder('rope', [x, y, 0], [0.18, 0.065, 0.18]));
    }
  }
  for (const x of [-0.48, 0, 0.48]) {
    parts.push(cylinder('metal', [x, 0.17, -0.09], [0.045, 0.04, 0.045], [Math.PI / 2, 0, 0]));
    parts.push(cylinder('metal', [x, 2.03, -0.09], [0.045, 0.04, 0.045], [Math.PI / 2, 0, 0]));
  }
  return parts;
}

function rotateDoorPart(part: StructurePart, angle: number): StructurePart {
  const hingeX = -0.52;
  const localX = part.position[0] - hingeX;
  const localZ = part.position[2];
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    ...part,
    position: [
      hingeX + localX * cosine + localZ * sine,
      part.position[1],
      -localX * sine + localZ * cosine,
    ],
    rotation: [
      part.rotation?.[0] ?? 0,
      (part.rotation?.[1] ?? 0) + angle,
      part.rotation?.[2] ?? 0,
    ],
  };
}

function doorParts(open: boolean): StructurePart[] {
  const parts: StructurePart[] = [
    box('darkWood', [-0.67, 1.08, 0], [0.15, 2.16, 0.16]),
    box('darkWood', [0.67, 1.08, 0], [0.15, 2.16, 0.16]),
    box('darkWood', [0, 2.04, 0], [1.42, 0.14, 0.15]),
    box('darkWood', [0, 0.13, 0], [1.35, 0.11, 0.14]),
    cylinder('rope', [-0.67, 0.28, 0], [0.2, 0.055, 0.2]),
    cylinder('rope', [-0.67, 1.86, 0], [0.2, 0.055, 0.2]),
  ];
  const panel: StructurePart[] = [];
  for (let index = 0; index < 4; index += 1) {
    panel.push(box(
      index % 2 === 0 ? 'wood' : 'woodAlt',
      [-0.39 + index * 0.255, 1.04, 0.025],
      [0.225, 1.67, 0.09],
      [0, 0, (index - 1.5) * 0.018],
    ));
  }
  panel.push(
    box('darkWood', [-0.01, 0.52, -0.04], [1.02, 0.085, 0.1], [0, 0, 0.46]),
    box('darkWood', [-0.01, 1.52, -0.04], [1.02, 0.085, 0.1], [0, 0, -0.46]),
    cylinder('rope', [-0.53, 0.38, 0], [0.19, 0.06, 0.19]),
    cylinder('rope', [-0.53, 1.7, 0], [0.19, 0.06, 0.19]),
    cylinder('metal', [0.41, 1.04, -0.11], [0.075, 0.065, 0.075], [Math.PI / 2, 0, 0]),
  );
  const angle = open ? -Math.PI * 0.58 : 0;
  parts.push(...panel.map((part) => rotateDoorPart(part, angle)));
  return parts;
}

function pillarParts(): StructurePart[] {
  const parts: StructurePart[] = [
    cylinder('darkWood', [0, 1.08, 0], [0.26, 2.16, 0.26]),
    box('wood', [0, 0.12, 0], [0.7, 0.15, 0.18]),
    box('woodAlt', [0, 0.12, 0], [0.18, 0.15, 0.7]),
    box('darkWood', [0, 2.05, 0], [0.48, 0.13, 0.48], [0, Math.PI / 4, 0]),
  ];
  for (const y of [0.28, 0.38, 1.82, 1.92]) {
    parts.push(cylinder('rope', [0, y, 0], [0.31, 0.045, 0.31]));
  }
  for (const rotation of [0, Math.PI / 2]) {
    parts.push(box('darkWood', [0, 0.48, 0], [0.09, 0.72, 0.09], [rotation, 0, Math.PI / 4]));
  }
  return parts;
}

function stairsParts(): StructurePart[] {
  const parts: StructurePart[] = [];
  const rise = 1.86;
  const run = 1.15;
  const angle = Math.atan2(rise, run);
  for (const x of [-0.48, 0.48]) {
    parts.push(box('darkWood', [x, 1.05, 0], [0.11, 0.13, 2.18], [-angle, 0, 0]));
    parts.push(cylinder('rope', [x, 0.25, 0.48], [0.16, 0.055, 0.16]));
    parts.push(cylinder('rope', [x, 1.83, -0.48], [0.16, 0.055, 0.16]));
  }
  for (let index = 0; index < 7; index += 1) {
    const progress = index / 6;
    parts.push(box(
      index % 2 === 0 ? 'wood' : 'woodAlt',
      [0, 0.18 + progress * rise, 0.54 - progress * 1.08],
      [1.12, 0.13, 0.27],
    ));
    for (const x of [-0.43, 0.43]) {
      parts.push(cylinder('metal', [x, 0.25 + progress * rise, 0.54 - progress * 1.08], [0.04, 0.035, 0.04]));
    }
  }
  return parts;
}

function floorParts(): StructurePart[] {
  const parts: StructurePart[] = [
    box('darkWood', [0, -0.06, -0.5], [1.38, 0.11, 0.11]),
    box('darkWood', [0, -0.06, 0.5], [1.38, 0.11, 0.11]),
  ];
  for (let index = 0; index < 5; index += 1) {
    parts.push(box(
      index % 2 === 0 ? 'wood' : 'woodAlt',
      [-0.55 + index * 0.275, 0.035 + Math.sin(index * 2.2) * 0.008, 0],
      [0.25, 0.13, 1.32],
      [0, (index - 2) * 0.008, 0],
    ));
    for (const z of [-0.49, 0.49]) {
      parts.push(cylinder('metal', [-0.55 + index * 0.275, 0.12, z], [0.038, 0.035, 0.038]));
    }
  }
  return parts;
}

function roofParts(): StructurePart[] {
  const pitch = 0.29;
  const parts: StructurePart[] = [
    box('darkWood', [0, 0.27, 0], [0.12, 0.12, 1.5]),
    box('darkWood', [-0.63, 0.08, 0], [0.1, 0.11, 1.5]),
    box('darkWood', [0.63, 0.08, 0], [0.1, 0.11, 1.5]),
    box('fiber', [-0.34, 0.18, 0], [0.78, 0.075, 1.48], [0, 0, pitch]),
    box('fiber', [0.34, 0.18, 0], [0.78, 0.075, 1.48], [0, 0, -pitch]),
  ];
  for (const z of [-0.55, 0, 0.55]) {
    parts.push(box('wood', [0, 0.17, z], [1.38, 0.075, 0.08]));
    parts.push(cylinder('rope', [0, 0.31, z], [0.14, 0.045, 0.14]));
  }
  return parts;
}

export function createRaftStructureParts(type: RaftStructureType, open = false): StructurePart[] {
  if (type === 'wall') return wallParts();
  if (type === 'door') return doorParts(open);
  if (type === 'pillar') return pillarParts();
  if (type === 'stairs') return stairsParts();
  if (type === 'floor') return floorParts();
  return roofParts();
}
