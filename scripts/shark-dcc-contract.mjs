const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BINARY_CHUNK = 0x004e4942;
const GLTF_TRIANGLES = 4;
const ACCESSOR_COMPONENT_BYTES = new Map([
  [5120, 1],
  [5121, 1],
  [5122, 2],
  [5123, 2],
  [5125, 4],
  [5126, 4],
]);
const ACCESSOR_TYPE_COMPONENTS = new Map([
  ['SCALAR', 1],
  ['VEC2', 2],
  ['VEC3', 3],
  ['VEC4', 4],
  ['MAT4', 16],
]);
const IDENTITY_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

function finiteNumbers(values, length) {
  return Array.isArray(values) && values.length === length && values.every(Number.isFinite);
}

function namedIndex(items, label, failures) {
  const result = new Map();
  for (const [index, item] of (items ?? []).entries()) {
    if (typeof item?.name !== 'string' || !item.name) continue;
    if (result.has(item.name)) failures.push(`duplicate ${label} name: ${item.name}`);
    else result.set(item.name, index);
  }
  return result;
}

function accessorAt(document, index, label, failures) {
  const accessor = document.accessors?.[index];
  if (!accessor) failures.push(`${label} references missing accessor ${String(index)}`);
  return accessor;
}

function validateAccessorStorage(document, binaryChunkBytes, failures) {
  const bufferViews = document.bufferViews ?? [];
  for (const [index, bufferView] of bufferViews.entries()) {
    const offset = bufferView.byteOffset ?? 0;
    if (bufferView.buffer !== 0) failures.push(`bufferView ${index} must reference the internal buffer 0`);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(bufferView.byteLength) || bufferView.byteLength <= 0) {
      failures.push(`bufferView ${index} has an invalid byte range`);
      continue;
    }
    if (offset + bufferView.byteLength > binaryChunkBytes) {
      failures.push(`bufferView ${index} exceeds the internal binary buffer`);
    }
    if (bufferView.byteStride !== undefined
      && (!Number.isInteger(bufferView.byteStride)
        || bufferView.byteStride < 4
        || bufferView.byteStride > 252
        || bufferView.byteStride % 4 !== 0)) {
      failures.push(`bufferView ${index} has an invalid byteStride`);
    }
  }

  for (const [index, accessor] of (document.accessors ?? []).entries()) {
    if (accessor.sparse !== undefined) failures.push(`accessor ${index} must not use sparse storage`);
    const bufferView = bufferViews[accessor.bufferView];
    if (!Number.isInteger(accessor.bufferView) || !bufferView) {
      failures.push(`accessor ${index} must reference a valid bufferView`);
      continue;
    }
    const componentBytes = ACCESSOR_COMPONENT_BYTES.get(accessor.componentType);
    const componentCount = ACCESSOR_TYPE_COMPONENTS.get(accessor.type);
    if (!componentBytes || !componentCount) {
      failures.push(`accessor ${index} has an unsupported componentType or type`);
      continue;
    }
    if (!Number.isInteger(accessor.count) || accessor.count <= 0) {
      failures.push(`accessor ${index} count must be a positive integer`);
      continue;
    }
    const accessorOffset = accessor.byteOffset ?? 0;
    if (!Number.isInteger(accessorOffset) || accessorOffset < 0) {
      failures.push(`accessor ${index} has an invalid byteOffset`);
      continue;
    }
    const elementBytes = componentBytes * componentCount;
    const stride = bufferView.byteStride ?? elementBytes;
    if (stride < elementBytes) failures.push(`accessor ${index} byteStride is smaller than one element`);
    const lastByte = accessorOffset + (accessor.count - 1) * stride + elementBytes;
    if (lastByte > bufferView.byteLength) failures.push(`accessor ${index} exceeds bufferView ${accessor.bufferView}`);
    if ((bufferView.byteOffset ?? 0) % componentBytes !== 0 || accessorOffset % componentBytes !== 0) {
      failures.push(`accessor ${index} is not aligned to its component size`);
    }
  }
}

function multiplyMatrices(left, right) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) {
        result[column * 4 + row] += left[index * 4 + row] * right[column * 4 + index];
      }
    }
  }
  return result;
}

function localNodeMatrix(node) {
  if (finiteNumbers(node?.matrix, 16)) return [...node.matrix];
  const [x, y, z, w] = finiteNumbers(node?.rotation, 4) ? node.rotation : [0, 0, 0, 1];
  const [sx, sy, sz] = finiteNumbers(node?.scale, 3) ? node.scale : [1, 1, 1];
  const [tx, ty, tz] = finiteNumbers(node?.translation, 3) ? node.translation : [0, 0, 0];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function worldNodeMatrix(index, nodes, parents, cache, visiting, failures) {
  if (cache.has(index)) return cache.get(index);
  if (visiting.has(index)) {
    failures.push(`node hierarchy contains a cycle at ${nodes[index]?.name ?? index}`);
    return IDENTITY_MATRIX;
  }
  visiting.add(index);
  const parent = parents.get(index);
  const parentMatrix = Number.isInteger(parent)
    ? worldNodeMatrix(parent, nodes, parents, cache, visiting, failures)
    : IDENTITY_MATRIX;
  const matrix = multiplyMatrices(parentMatrix, localNodeMatrix(nodes[index]));
  visiting.delete(index);
  cache.set(index, matrix);
  return matrix;
}

function includeTransformedBounds(minimum, maximum, matrix, aggregateMinimum, aggregateMaximum) {
  for (const x of [minimum[0], maximum[0]]) {
    for (const y of [minimum[1], maximum[1]]) {
      for (const z of [minimum[2], maximum[2]]) {
        const point = [
          matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
          matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
          matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
        ];
        point.forEach((value, axis) => {
          aggregateMinimum[axis] = Math.min(aggregateMinimum[axis], value);
          aggregateMaximum[axis] = Math.max(aggregateMaximum[axis], value);
        });
      }
    }
  }
}

function nodeDescendsFrom(nodeIndex, rootIndex, parents) {
  let cursor = nodeIndex;
  const visited = new Set();
  while (Number.isInteger(cursor) && !visited.has(cursor)) {
    if (cursor === rootIndex) return true;
    visited.add(cursor);
    cursor = parents.get(cursor);
  }
  return false;
}

function animationDuration(document, animation, failures) {
  let duration = 0;
  if (!(animation.samplers?.length > 0)) failures.push(`animation ${animation.name} has no samplers`);
  if (!(animation.channels?.length > 0)) failures.push(`animation ${animation.name} has no channels`);
  for (const [index, sampler] of (animation.samplers ?? []).entries()) {
    if (sampler.interpolation === 'STEP') {
      failures.push(`animation ${animation.name} sampler ${index} uses STEP interpolation`);
    }
    if (sampler.interpolation !== undefined && !['LINEAR', 'CUBICSPLINE'].includes(sampler.interpolation)) {
      failures.push(`animation ${animation.name} sampler ${index} uses unsupported interpolation`);
    }
    const input = accessorAt(document, sampler.input, `animation ${animation.name} sampler ${index}`, failures);
    const output = accessorAt(document, sampler.output, `animation ${animation.name} sampler ${index}`, failures);
    const minimum = input?.min?.[0];
    const maximum = input?.max?.[0];
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum) {
      failures.push(`animation ${animation.name} sampler ${index} lacks a finite increasing time range`);
      continue;
    }
    if (Math.abs(minimum) > 0.0001) failures.push(`animation ${animation.name} sampler ${index} must start at 0 seconds`);
    if (input?.type !== 'SCALAR' || input?.componentType !== 5126) {
      failures.push(`animation ${animation.name} sampler ${index} input must be a FLOAT SCALAR accessor`);
    }
    duration = Math.max(duration, maximum - minimum);
    if (!output || !Number.isInteger(output.count) || output.count <= 0) {
      failures.push(`animation ${animation.name} sampler ${index} has no output values`);
    } else if (input && output.count !== input.count * (sampler.interpolation === 'CUBICSPLINE' ? 3 : 1)) {
      failures.push(`animation ${animation.name} sampler ${index} output count does not match its input`);
    }
  }
  return duration;
}

export function validateSharkDccContractDefinition(contract) {
  const failures = [];
  if (contract?.schemaVersion !== 1) failures.push('DCC contract must use schemaVersion 1');
  if (contract?.format !== 'glb') failures.push('DCC contract format must be glb');
  if (!contract?.rootNode) failures.push('DCC contract rootNode is missing');
  if (!Number.isFinite(contract?.file?.maxBytes) || contract.file.maxBytes <= 0) {
    failures.push('DCC contract maxBytes must be positive');
  }
  for (const [label, values] of [
    ['requiredNodes', contract?.requiredNodes],
    ['requiredJoints', contract?.skinning?.requiredJoints],
    ['requiredSkinnedNodes', contract?.skinning?.requiredSkinnedNodes],
  ]) {
    if (!Array.isArray(values) || values.length === 0 || new Set(values).size !== values.length) {
      failures.push(`DCC contract ${label} must be a non-empty unique list`);
    }
  }
  const bindings = Object.entries(contract?.materialBindings ?? {});
  if (bindings.length === 0) failures.push('DCC contract materialBindings are missing');
  const hierarchy = Object.entries(contract?.skinning?.jointHierarchy ?? {});
  if (hierarchy.length === 0) failures.push('DCC contract jointHierarchy is missing');
  const requiredNodes = new Set(contract?.requiredNodes ?? []);
  for (const [nodeName, materialName] of bindings) {
    if (!requiredNodes.has(nodeName)) failures.push(`DCC contract material binding node is not required: ${nodeName}`);
    if (typeof materialName !== 'string' || !materialName) failures.push(`DCC contract material binding is invalid: ${nodeName}`);
  }
  for (const nodeName of contract?.skinning?.requiredSkinnedNodes ?? []) {
    if (!bindings.some(([boundNode]) => boundNode === nodeName)) {
      failures.push(`DCC contract skinned node has no material binding: ${nodeName}`);
    }
  }
  const requiredJoints = new Set(contract?.skinning?.requiredJoints ?? []);
  const rootJoint = contract?.skinning?.rootJoint;
  if (typeof rootJoint !== 'string' || !requiredJoints.has(rootJoint)) {
    failures.push('DCC contract skinning rootJoint must be a required joint');
  }
  for (const [child, parent] of hierarchy) {
    if (!requiredJoints.has(child) || !requiredJoints.has(parent)) {
      failures.push(`DCC contract joint hierarchy references a non-required joint: ${child} -> ${parent}`);
    }
  }
  for (const joint of requiredJoints) {
    if (joint === rootJoint) continue;
    const visited = new Set([joint]);
    let cursor = contract?.skinning?.jointHierarchy?.[joint];
    while (cursor && cursor !== rootJoint && !visited.has(cursor)) {
      visited.add(cursor);
      cursor = contract?.skinning?.jointHierarchy?.[cursor];
    }
    if (cursor !== rootJoint) failures.push(`DCC contract joint does not descend from ${rootJoint}: ${joint}`);
  }
  const animationNames = (contract?.animations ?? []).map((entry) => entry?.name);
  if (animationNames.length === 0 || new Set(animationNames).size !== animationNames.length) {
    failures.push('DCC contract animations must be a non-empty unique list');
  }
  for (const animation of contract?.animations ?? []) {
    if (typeof animation?.name !== 'string' || !animation.name
      || !Number.isFinite(animation.minimumSeconds)
      || !Number.isFinite(animation.maximumSeconds)
      || animation.minimumSeconds <= 0
      || animation.maximumSeconds <= animation.minimumSeconds) {
      failures.push(`DCC contract animation range is invalid: ${animation?.name ?? '<unnamed>'}`);
    }
    if (!Array.isArray(animation?.requiredTargets)
      || animation.requiredTargets.length === 0
      || new Set(animation.requiredTargets).size !== animation.requiredTargets.length
      || animation.requiredTargets.some((target) => !requiredJoints.has(target))) {
      failures.push(`DCC contract animation targets are invalid: ${animation?.name ?? '<unnamed>'}`);
    }
  }
  if (!finiteNumbers(contract?.boundsMeters?.minimum, 3) || !finiteNumbers(contract?.boundsMeters?.maximum, 3)) {
    failures.push('DCC contract boundsMeters must contain finite minimum and maximum vectors');
  } else if (contract.boundsMeters.minimum.some((value, index) => value <= 0 || value >= contract.boundsMeters.maximum[index])) {
    failures.push('DCC contract boundsMeters ranges must be positive and increasing');
  }
  if (!Number.isFinite(contract?.boundsMeters?.metadataToleranceMeters)
    || contract.boundsMeters.metadataToleranceMeters < 0
    || contract.boundsMeters.metadataToleranceMeters > 0.25) {
    failures.push('DCC contract bounds metadata tolerance must be between 0 and 0.25 meters');
  }
  if (!Number.isInteger(contract?.geometry?.minimumTriangles)
    || !Number.isInteger(contract?.geometry?.maximumTriangles)
    || !Number.isInteger(contract?.geometry?.maximumVertices)
    || contract.geometry.minimumTriangles <= 0
    || contract.geometry.maximumTriangles < contract.geometry.minimumTriangles
    || contract.geometry.maximumVertices <= 0) {
    failures.push('DCC contract geometry budgets are invalid');
  }
  if (contract?.skinning?.maximumInfluences !== 4
    || !Number.isInteger(contract?.skinning?.minimumJoints)
    || !Number.isInteger(contract?.skinning?.maximumJoints)
    || contract.skinning.minimumJoints <= 0
    || contract.skinning.maximumJoints < contract.skinning.minimumJoints) {
    failures.push('DCC contract skinning budgets are invalid');
  }
  return failures;
}

export function parseGlb(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.byteLength < 20) throw new Error('GLB is shorter than its header and JSON chunk');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('GLB magic is invalid');
  if (view.getUint32(4, true) !== 2) throw new Error('GLB version must be 2');
  if (view.getUint32(8, true) !== data.byteLength) throw new Error('GLB declared length does not match the file');

  let offset = 12;
  let document = null;
  let binaryChunkBytes = 0;
  let binaryChunkFound = false;
  let chunkIndex = 0;
  while (offset < data.byteLength) {
    if (offset + 8 > data.byteLength) throw new Error('GLB chunk header is truncated');
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkLength % 4 !== 0 || offset + chunkLength > data.byteLength) {
      throw new Error('GLB chunk length is invalid');
    }
    const payload = data.subarray(offset, offset + chunkLength);
    if (chunkIndex === 0 && chunkType !== GLB_JSON_CHUNK) throw new Error('GLB first chunk must be JSON');
    if (chunkType === GLB_JSON_CHUNK) {
      if (document) throw new Error('GLB contains more than one JSON chunk');
      const text = new TextDecoder().decode(payload).replace(/[\u0000\u0020]+$/g, '');
      document = JSON.parse(text);
    } else if (chunkType === GLB_BINARY_CHUNK) {
      if (binaryChunkFound) throw new Error('GLB contains more than one binary chunk');
      binaryChunkFound = true;
      binaryChunkBytes = chunkLength;
    }
    offset += chunkLength;
    chunkIndex += 1;
  }
  if (!document) throw new Error('GLB JSON document is missing');
  return { document, binaryChunkBytes };
}

export function validateSharkDccDocument(document, contract, container = {}) {
  const failures = validateSharkDccContractDefinition(contract);
  const fileSize = container.fileSize ?? 0;
  const binaryChunkBytes = container.binaryChunkBytes ?? 0;
  if (document?.asset?.version !== '2.0') failures.push('asset.version must be 2.0');
  if (fileSize > contract.file.maxBytes) failures.push(`GLB file size ${fileSize} exceeds ${contract.file.maxBytes}`);
  if (contract.file.requireBinaryChunk && binaryChunkBytes <= 0) failures.push('GLB binary chunk is missing');
  if (contract.file.forbidExternalUris && (document.buffers ?? []).some((buffer) => buffer?.uri)) {
    failures.push('GLB contains an external buffer URI');
  }
  if (contract.file.forbidEmbeddedImages && ((document.images?.length ?? 0) > 0 || (document.textures?.length ?? 0) > 0)) {
    failures.push('GLB must not embed images or textures; runtime remaps approved PBR materials by slot name');
  }
  const allowedRequiredExtensions = new Set(contract.file.allowedRequiredExtensions ?? []);
  for (const extension of document.extensionsRequired ?? []) {
    if (!allowedRequiredExtensions.has(extension)) failures.push(`GLB requires unsupported extension: ${extension}`);
  }
  const declaredBinaryBytes = document.buffers?.[0]?.byteLength ?? 0;
  if (document.buffers?.length !== 1 || document.buffers[0]?.uri) failures.push('GLB must contain exactly one internal buffer');
  if (!Number.isInteger(declaredBinaryBytes)
    || declaredBinaryBytes <= 0
    || declaredBinaryBytes > binaryChunkBytes
    || binaryChunkBytes - declaredBinaryBytes > 3) {
    failures.push('GLB internal buffer length is invalid');
  }
  validateAccessorStorage(document, binaryChunkBytes, failures);

  const metadata = document.asset?.extras?.driftwake;
  for (const [key, expected] of Object.entries(contract.metadata)) {
    if (metadata?.[key] !== expected) failures.push(`asset.extras.driftwake.${key} must be ${JSON.stringify(expected)}`);
  }
  if (typeof metadata?.sourceDcc !== 'string' || metadata.sourceDcc.trim().length === 0) {
    failures.push('asset.extras.driftwake.sourceDcc is required');
  }
  const bounds = metadata?.boundsMeters;
  if (!finiteNumbers(bounds, 3)) {
    failures.push('asset.extras.driftwake.boundsMeters must be a finite width/height/length vector');
  } else {
    bounds.forEach((value, index) => {
      if (value < contract.boundsMeters.minimum[index] || value > contract.boundsMeters.maximum[index]) {
        failures.push(`boundsMeters[${index}] ${value} is outside ${contract.boundsMeters.minimum[index]}..${contract.boundsMeters.maximum[index]}`);
      }
    });
  }

  const nodeIndex = namedIndex(document.nodes, 'node', failures);
  const materialIndex = namedIndex(document.materials, 'material', failures);
  const animationIndex = namedIndex(document.animations, 'animation', failures);
  const allRequiredNodes = new Set([
    ...contract.requiredNodes,
    ...contract.skinning.requiredJoints,
  ]);
  for (const name of allRequiredNodes) {
    if (!nodeIndex.has(name)) failures.push(`required node is missing: ${name}`);
  }
  const rootIndex = nodeIndex.get(contract.rootNode);
  const parents = new Map();
  for (const [parent, node] of (document.nodes ?? []).entries()) {
    for (const [property, length] of [['translation', 3], ['rotation', 4], ['scale', 3]]) {
      if (node[property] !== undefined && !finiteNumbers(node[property], length)) {
        failures.push(`node ${node.name ?? parent} has invalid ${property}`);
      }
    }
    if (node.matrix !== undefined && !finiteNumbers(node.matrix, 16)) {
      failures.push(`node ${node.name ?? parent} has an invalid matrix`);
    }
    if (node.matrix !== undefined && ['translation', 'rotation', 'scale'].some((property) => node[property] !== undefined)) {
      failures.push(`node ${node.name ?? parent} mixes matrix and TRS transforms`);
    }
    if (finiteNumbers(node.rotation, 4)) {
      const length = Math.hypot(...node.rotation);
      if (Math.abs(length - 1) > 0.01) failures.push(`node ${node.name ?? parent} rotation quaternion is not normalized`);
    }
    if (finiteNumbers(node.scale, 3) && node.scale.some((value) => Math.abs(value) < 0.0001)) {
      failures.push(`node ${node.name ?? parent} has a zero scale axis`);
    }
    for (const child of node.children ?? []) {
      if (!Number.isInteger(child) || !document.nodes?.[child]) {
        failures.push(`node ${node.name ?? parent} references an invalid child ${String(child)}`);
        continue;
      }
      if (parents.has(child)) failures.push(`node ${child} has more than one parent`);
      parents.set(child, parent);
    }
  }
  if (Number.isInteger(rootIndex)) {
    const activeScene = document.scenes?.[document.scene ?? 0];
    if (!activeScene?.nodes?.includes(rootIndex)) failures.push(`${contract.rootNode} is not an active scene root`);
    if (parents.has(rootIndex)) failures.push(`${contract.rootNode} must not have a parent`);
    for (const name of allRequiredNodes) {
      const index = nodeIndex.get(name);
      if (Number.isInteger(index) && !nodeDescendsFrom(index, rootIndex, parents)) {
        failures.push(`required node is outside ${contract.rootNode}: ${name}`);
      }
    }
  }
  const worldMatrices = new Map();
  for (const index of (document.nodes ?? []).keys()) {
    worldNodeMatrix(index, document.nodes, parents, worldMatrices, new Set(), failures);
  }
  for (const [childName, parentName] of Object.entries(contract.skinning.jointHierarchy ?? {})) {
    const childIndex = nodeIndex.get(childName);
    const expectedParentIndex = nodeIndex.get(parentName);
    if (Number.isInteger(childIndex) && Number.isInteger(expectedParentIndex) && parents.get(childIndex) !== expectedParentIndex) {
      failures.push(`joint ${childName} must be parented to ${parentName}`);
    }
  }

  const usedMaterials = new Set();
  const boundMeshIndices = new Set();
  const requiredMaterialNames = new Set(Object.values(contract.materialBindings));
  if ((document.materials?.length ?? 0) !== requiredMaterialNames.size) {
    failures.push(`material count must be exactly ${requiredMaterialNames.size}`);
  }
  for (const [index, material] of (document.materials ?? []).entries()) {
    if (typeof material?.name !== 'string' || !material.name) failures.push(`material ${index} must have an approved name`);
  }
  let triangles = 0;
  let vertices = 0;
  const geometryMinimum = [Infinity, Infinity, Infinity];
  const geometryMaximum = [-Infinity, -Infinity, -Infinity];
  const requiredSkinnedNodes = new Set(contract.skinning.requiredSkinnedNodes);
  for (const [nodeName, materialName] of Object.entries(contract.materialBindings)) {
    const currentNodeIndex = nodeIndex.get(nodeName);
    const expectedMaterialIndex = materialIndex.get(materialName);
    if (!Number.isInteger(expectedMaterialIndex)) {
      failures.push(`required material is missing: ${materialName}`);
      continue;
    }
    if (!Number.isInteger(currentNodeIndex)) continue;
    const node = document.nodes[currentNodeIndex];
    const mesh = document.meshes?.[node.mesh];
    if (!mesh?.primitives?.length) {
      failures.push(`node ${nodeName} has no mesh primitives`);
      continue;
    }
    boundMeshIndices.add(node.mesh);
    if (requiredSkinnedNodes.has(nodeName) && node.skin !== 0) {
      failures.push(`node ${nodeName} must reference the single skin at index 0`);
    }
    for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
      const label = `${nodeName} primitive ${primitiveIndex}`;
      if ((primitive.mode ?? GLTF_TRIANGLES) !== contract.geometry.primitiveMode) {
        failures.push(`${label} must use TRIANGLES mode`);
      }
      if (primitive.material !== expectedMaterialIndex) {
        failures.push(`${label} must use material ${materialName}`);
      } else {
        usedMaterials.add(materialName);
      }
      const attributes = primitive.attributes ?? {};
      const requiredAttributes = requiredSkinnedNodes.has(nodeName)
        ? contract.skinning.requiredAttributes
        : ['POSITION', 'NORMAL', 'TEXCOORD_0'];
      for (const attribute of requiredAttributes) {
        if (!Number.isInteger(attributes[attribute])) failures.push(`${label} lacks ${attribute}`);
      }
      const position = accessorAt(document, attributes.POSITION, `${label} POSITION`, failures);
      const normal = accessorAt(document, attributes.NORMAL, `${label} NORMAL`, failures);
      const uv = accessorAt(document, attributes.TEXCOORD_0, `${label} TEXCOORD_0`, failures);
      if (position && (position.type !== 'VEC3' || !finiteNumbers(position.min, 3) || !finiteNumbers(position.max, 3))) {
        failures.push(`${label} POSITION must be VEC3 with finite min/max bounds`);
      } else if (position && position.min.some((value, axis) => value > position.max[axis])) {
        failures.push(`${label} POSITION min/max bounds are inverted`);
      } else if (position) {
        includeTransformedBounds(
          position.min,
          position.max,
          worldMatrices.get(currentNodeIndex) ?? IDENTITY_MATRIX,
          geometryMinimum,
          geometryMaximum,
        );
      }
      if (normal && normal.type !== 'VEC3') failures.push(`${label} NORMAL must be VEC3`);
      if (uv && uv.type !== 'VEC2') failures.push(`${label} TEXCOORD_0 must be VEC2`);
      for (const [attributeName, accessor] of [['NORMAL', normal], ['TEXCOORD_0', uv]]) {
        if (position && accessor && accessor.count !== position.count) {
          failures.push(`${label} ${attributeName} count must match POSITION`);
        }
      }
      if (requiredSkinnedNodes.has(nodeName)) {
        const joints = accessorAt(document, attributes.JOINTS_0, `${label} JOINTS_0`, failures);
        const weights = accessorAt(document, attributes.WEIGHTS_0, `${label} WEIGHTS_0`, failures);
        if (joints && (joints.type !== 'VEC4' || ![5121, 5123].includes(joints.componentType))) {
          failures.push(`${label} JOINTS_0 must be an unsigned VEC4`);
        }
        if (weights && weights.type !== 'VEC4') failures.push(`${label} WEIGHTS_0 must be VEC4`);
        if (weights && weights.componentType !== 5126
          && !([5121, 5123].includes(weights.componentType) && weights.normalized === true)) {
          failures.push(`${label} WEIGHTS_0 must use FLOAT or normalized unsigned components`);
        }
        if (position && joints && joints.count !== position.count) failures.push(`${label} JOINTS_0 count must match POSITION`);
        if (position && weights && weights.count !== position.count) failures.push(`${label} WEIGHTS_0 count must match POSITION`);
      }
      const indexAccessor = Number.isInteger(primitive.indices)
        ? accessorAt(document, primitive.indices, `${label} indices`, failures)
        : null;
      const elementCount = indexAccessor?.count ?? position?.count ?? 0;
      if (indexAccessor && ![5121, 5123, 5125].includes(indexAccessor.componentType)) {
        failures.push(`${label} index accessor must use an unsigned integer component type`);
      }
      if (indexAccessor && indexAccessor.type !== 'SCALAR') failures.push(`${label} index accessor must be SCALAR`);
      if (!Number.isInteger(elementCount) || elementCount <= 0 || elementCount % 3 !== 0) {
        failures.push(`${label} triangle element count is invalid`);
      } else {
        triangles += elementCount / 3;
      }
      if (Number.isInteger(position?.count)) vertices += position.count;
    }
  }
  for (const index of (document.meshes ?? []).keys()) {
    if (!boundMeshIndices.has(index)) failures.push(`mesh ${document.meshes[index]?.name ?? index} is outside the approved material binding contract`);
  }
  for (const name of materialIndex.keys()) {
    if (!requiredMaterialNames.has(name)) failures.push(`material is outside the approved remap contract: ${name}`);
  }
  for (const materialName of Object.values(contract.materialBindings)) {
    if (!usedMaterials.has(materialName)) failures.push(`required material is not used by its bound mesh: ${materialName}`);
  }
  if (triangles < contract.geometry.minimumTriangles || triangles > contract.geometry.maximumTriangles) {
    failures.push(`triangle count ${triangles} is outside ${contract.geometry.minimumTriangles}..${contract.geometry.maximumTriangles}`);
  }
  if (vertices <= 0 || vertices > contract.geometry.maximumVertices) {
    failures.push(`vertex count ${vertices} is outside 1..${contract.geometry.maximumVertices}`);
  }

  const actualBounds = geometryMinimum.every(Number.isFinite) && geometryMaximum.every(Number.isFinite)
    ? geometryMaximum.map((value, axis) => value - geometryMinimum[axis])
    : null;
  if (!actualBounds) {
    failures.push('mesh geometry does not expose finite world-space bounds');
  } else {
    actualBounds.forEach((value, axis) => {
      if (value < contract.boundsMeters.minimum[axis] || value > contract.boundsMeters.maximum[axis]) {
        failures.push(`actual boundsMeters[${axis}] ${value} is outside ${contract.boundsMeters.minimum[axis]}..${contract.boundsMeters.maximum[axis]}`);
      }
      if (finiteNumbers(bounds, 3) && Math.abs(value - bounds[axis]) > contract.boundsMeters.metadataToleranceMeters) {
        failures.push(`asset boundsMeters[${axis}] does not match geometry (${bounds[axis]} vs ${value})`);
      }
    });
  }

  const jointNames = new Set();
  let largestSkin = 0;
  if ((document.skins?.length ?? 0) !== 1) failures.push('GLB must contain exactly one skin');
  for (const skin of document.skins ?? []) {
    largestSkin = Math.max(largestSkin, skin.joints?.length ?? 0);
    if (!Array.isArray(skin.joints)
      || skin.joints.length === 0
      || new Set(skin.joints).size !== skin.joints.length
      || skin.joints.some((joint) => !Number.isInteger(joint) || !document.nodes?.[joint])) {
      failures.push(`skin ${skin.name ?? '<unnamed>'} joints must be a non-empty unique list of node indices`);
    }
    for (const joint of skin.joints ?? []) {
      const name = document.nodes?.[joint]?.name;
      if (name) jointNames.add(name);
    }
    const inverseBindMatrices = accessorAt(document, skin.inverseBindMatrices, `skin ${skin.name ?? '<unnamed>'}`, failures);
    if (inverseBindMatrices && (inverseBindMatrices.type !== 'MAT4' || inverseBindMatrices.count !== skin.joints?.length)) {
      failures.push(`skin ${skin.name ?? '<unnamed>'} inverse bind matrices must be MAT4 and match its joint count`);
    }
    if (document.nodes?.[skin.skeleton]?.name !== contract.skinning.rootJoint) {
      failures.push(`skin ${skin.name ?? '<unnamed>'} skeleton must be ${contract.skinning.rootJoint}`);
    }
  }
  if (largestSkin < contract.skinning.minimumJoints || largestSkin > contract.skinning.maximumJoints) {
    failures.push(`largest skin joint count ${largestSkin} is outside ${contract.skinning.minimumJoints}..${contract.skinning.maximumJoints}`);
  }
  for (const joint of contract.skinning.requiredJoints) {
    if (!jointNames.has(joint)) failures.push(`required skin joint is missing: ${joint}`);
  }

  const requiredAnimationNames = new Set(contract.animations.map((entry) => entry.name));
  if ((document.animations?.length ?? 0) !== requiredAnimationNames.size) {
    failures.push(`animation count must be exactly ${requiredAnimationNames.size}`);
  }
  for (const [index, animation] of (document.animations ?? []).entries()) {
    if (typeof animation?.name !== 'string' || !requiredAnimationNames.has(animation.name)) {
      failures.push(`animation is outside the approved contract: ${animation?.name ?? index}`);
    }
  }
  for (const animationContract of contract.animations) {
    const index = animationIndex.get(animationContract.name);
    if (!Number.isInteger(index)) {
      failures.push(`required animation is missing: ${animationContract.name}`);
      continue;
    }
    const animation = document.animations[index];
    const duration = animationDuration(document, animation, failures);
    if (duration < animationContract.minimumSeconds || duration > animationContract.maximumSeconds) {
      failures.push(`animation ${animationContract.name} duration ${duration} is outside ${animationContract.minimumSeconds}..${animationContract.maximumSeconds}`);
    }
    const targets = new Set();
    for (const [channelIndex, channel] of (animation.channels ?? []).entries()) {
      if (!animation.samplers?.[channel.sampler]) failures.push(`animation ${animation.name} channel ${channelIndex} references a missing sampler`);
      if (!['rotation', 'translation', 'scale'].includes(channel.target?.path)) {
        failures.push(`animation ${animation.name} channel ${channelIndex} has unsupported target path`);
      }
      const sampler = animation.samplers?.[channel.sampler];
      const output = sampler ? document.accessors?.[sampler.output] : null;
      const expectedOutputType = channel.target?.path === 'rotation' ? 'VEC4' : 'VEC3';
      if (output && (output.componentType !== 5126 || output.type !== expectedOutputType)) {
        failures.push(`animation ${animation.name} channel ${channelIndex} output must be FLOAT ${expectedOutputType}`);
      }
      const targetName = document.nodes?.[channel.target?.node]?.name;
      if (targetName) targets.add(targetName);
      else failures.push(`animation ${animation.name} channel ${channelIndex} targets a missing node`);
    }
    for (const target of animationContract.requiredTargets) {
      if (!targets.has(target)) failures.push(`animation ${animationContract.name} does not target ${target}`);
    }
  }

  return {
    failures,
    summary: {
      contractVersion: contract.schemaVersion,
      fileSize,
      binaryChunkBytes,
      nodes: document.nodes?.length ?? 0,
      materials: materialIndex.size,
      joints: largestSkin,
      triangles,
      vertices,
      animations: animationIndex.size,
      boundsMeters: bounds ?? null,
      actualBoundsMeters: actualBounds,
    },
  };
}
