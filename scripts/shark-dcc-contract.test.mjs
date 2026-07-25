import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseGlb,
  validateSharkDccContractDefinition,
  validateSharkDccDocument,
} from './shark-dcc-contract.mjs';

const contract = JSON.parse(readFileSync(
  new URL('../docs/contracts/graywake-shark-dcc-v1.json', import.meta.url),
  'utf8',
));

function createValidDocument() {
  const materialNames = [...new Set(Object.values(contract.materialBindings))];
  const names = [...new Set([
    contract.rootNode,
    ...contract.requiredNodes,
    ...contract.skinning.requiredJoints,
  ])];
  const nodes = names.map((name) => ({ name }));
  const nodeIndex = new Map(nodes.map((node, index) => [node.name, index]));
  const rootIndex = nodeIndex.get(contract.rootNode);
  const jointChildren = new Set(Object.keys(contract.skinning.jointHierarchy));
  nodes[rootIndex].children = names
    .filter((name) => name !== contract.rootNode && !jointChildren.has(name))
    .map((name) => nodeIndex.get(name));
  for (const [childName, parentName] of Object.entries(contract.skinning.jointHierarchy)) {
    const parent = nodes[nodeIndex.get(parentName)];
    parent.children ??= [];
    parent.children.push(nodeIndex.get(childName));
  }

  const materialIndex = new Map(materialNames.map((name, index) => [name, index]));
  const skinnedNodes = new Set(contract.skinning.requiredSkinnedNodes);
  const meshes = [];
  for (const [nodeName, materialName] of Object.entries(contract.materialBindings)) {
    const node = nodes[nodeIndex.get(nodeName)];
    node.mesh = meshes.length;
    if (skinnedNodes.has(nodeName)) node.skin = 0;
    meshes.push({
      name: `${nodeName}-mesh`,
      primitives: [{
        attributes: {
          POSITION: 0,
          NORMAL: 1,
          TEXCOORD_0: 2,
          ...(skinnedNodes.has(nodeName) ? { JOINTS_0: 3, WEIGHTS_0: 4 } : {}),
        },
        indices: 5,
        material: materialIndex.get(materialName),
        mode: 4,
      }],
    });
  }

  const accessors = [
    { componentType: 5126, count: 4200, type: 'VEC3', min: [-1, -0.5, -2.5], max: [1, 0.8, 2.5] },
    { componentType: 5126, count: 4200, type: 'VEC3' },
    { componentType: 5126, count: 4200, type: 'VEC2' },
    { componentType: 5123, count: 4200, type: 'VEC4' },
    { componentType: 5126, count: 4200, type: 'VEC4' },
    { componentType: 5123, count: 4200, type: 'SCALAR' },
    { componentType: 5126, count: contract.skinning.requiredJoints.length, type: 'MAT4' },
  ];
  const animations = contract.animations.map((animationContract) => {
    const input = accessors.length;
    const duration = (animationContract.minimumSeconds + animationContract.maximumSeconds) / 2;
    accessors.push({ componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [duration] });
    const output = accessors.length;
    accessors.push({ componentType: 5126, count: 2, type: 'VEC4' });
    return {
      name: animationContract.name,
      samplers: [{ input, output, interpolation: 'LINEAR' }],
      channels: animationContract.requiredTargets.map((target) => ({
        sampler: 0,
        target: { node: nodeIndex.get(target), path: 'rotation' },
      })),
    };
  });

  return {
    asset: {
      version: '2.0',
      extras: {
        driftwake: {
          ...contract.metadata,
          sourceDcc: 'Blender 4.x',
          boundsMeters: [2, 1.3, 5],
        },
      },
    },
    scene: 0,
    scenes: [{ nodes: [rootIndex] }],
    nodes,
    meshes,
    materials: materialNames.map((name) => ({ name })),
    skins: [{
      name: 'graywake-shark-skin',
      skeleton: nodeIndex.get(contract.skinning.rootJoint),
      joints: contract.skinning.requiredJoints.map((name) => nodeIndex.get(name)),
      inverseBindMatrices: 6,
    }],
    accessors,
    animations,
    ...createBufferLayout(accessors),
  };
}

function createBufferLayout(accessors) {
  const componentBytes = new Map([[5121, 1], [5123, 2], [5126, 4]]);
  const typeComponents = new Map([['SCALAR', 1], ['VEC2', 2], ['VEC3', 3], ['VEC4', 4], ['MAT4', 16]]);
  let byteOffset = 0;
  const bufferViews = accessors.map((accessor, index) => {
    const byteLength = componentBytes.get(accessor.componentType) * typeComponents.get(accessor.type) * accessor.count;
    const view = { buffer: 0, byteOffset, byteLength };
    accessor.bufferView = index;
    byteOffset += Math.ceil(byteLength / 4) * 4;
    return view;
  });
  return {
    bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };
}

function createGlb(document) {
  const json = Buffer.from(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const binaryLength = Math.ceil(document.buffers[0].byteLength / 4) * 4;
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const bytes = Buffer.alloc(totalLength, 0);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(totalLength, 8);
  bytes.writeUInt32LE(jsonLength, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  json.copy(bytes, 20);
  bytes.fill(0x20, 20 + json.length, 20 + jsonLength);
  const binaryHeader = 20 + jsonLength;
  bytes.writeUInt32LE(binaryLength, binaryHeader);
  bytes.writeUInt32LE(0x004e4942, binaryHeader + 4);
  return bytes;
}

describe('Graywake shark DCC contract', () => {
  it('keeps the machine-readable contract internally coherent', () => {
    expect(validateSharkDccContractDefinition(contract)).toEqual([]);
  });

  it('accepts a complete skinned, animated, material-remapped glTF document', () => {
    const document = createValidDocument();
    const result = validateSharkDccDocument(document, contract, {
      fileSize: 1_200_000,
      binaryChunkBytes: document.buffers[0].byteLength,
    });
    expect(result.failures).toEqual([]);
    expect(result.summary).toMatchObject({
      joints: 13,
      triangles: 12600,
      vertices: 37800,
      animations: 7,
      boundsMeters: [2, 1.3, 5],
      actualBoundsMeters: [2, 1.3, 5],
    });
  });

  it('rejects external texture payloads, material drift, a flat joint hierarchy and missing motion', () => {
    const document = createValidDocument();
    document.images = [{ uri: 'gum.png' }];
    document.textures = [{ source: 0 }];
    document.buffers[0].uri = 'shark.bin';
    document.meshes[0].primitives[0].material = -1;
    document.animations = document.animations.filter((animation) => animation.name !== 'attack_bite');
    const jawIndex = document.nodes.findIndex((node) => node.name === 'shark-jaw-lower');
    for (const node of document.nodes) node.children = node.children?.filter((child) => child !== jawIndex);
    document.nodes[0].children.push(jawIndex);

    const failures = validateSharkDccDocument(document, contract, {
      fileSize: 1_200_000,
      binaryChunkBytes: document.buffers[0].byteLength,
    }).failures;
    expect(failures).toEqual(expect.arrayContaining([
      expect.stringContaining('external buffer URI'),
      expect.stringContaining('must not embed images or textures'),
      expect.stringContaining('must use material graywake-shark-skin'),
      expect.stringContaining('joint shark-jaw-lower must be parented'),
      expect.stringContaining('required animation is missing: attack_bite'),
    ]));
  });

  it('rejects self-reported scale drift, extra rigs or clips, and out-of-range binary views', () => {
    const document = createValidDocument();
    document.asset.extras.driftwake.boundsMeters = [2.2, 1.3, 5];
    document.skins.push({ ...document.skins[0] });
    document.animations.push({ ...document.animations[0], name: 'debug_pose' });
    document.bufferViews[0].byteLength = document.buffers[0].byteLength + 4;

    const failures = validateSharkDccDocument(document, contract, {
      fileSize: 1_200_000,
      binaryChunkBytes: document.buffers[0].byteLength,
    }).failures;
    expect(failures).toEqual(expect.arrayContaining([
      expect.stringContaining('bufferView 0 exceeds'),
      expect.stringContaining('boundsMeters[0] does not match geometry'),
      expect.stringContaining('exactly one skin'),
      expect.stringContaining('animation count must be exactly'),
      expect.stringContaining('animation is outside the approved contract: debug_pose'),
    ]));
  });

  it('parses a GLB 2.0 container and rejects a forged declared length', () => {
    const document = createValidDocument();
    const bytes = createGlb(document);
    const parsed = parseGlb(bytes);
    expect(parsed.document.asset.version).toBe('2.0');
    expect(parsed.binaryChunkBytes).toBe(Math.ceil(document.buffers[0].byteLength / 4) * 4);
    const damaged = Buffer.from(bytes);
    damaged.writeUInt32LE(bytes.length + 4, 8);
    expect(() => parseGlb(damaged)).toThrow('declared length');
  });
});
