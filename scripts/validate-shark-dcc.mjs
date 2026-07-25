#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseGlb, validateSharkDccDocument } from './shark-dcc-contract.mjs';

const modelPath = process.argv[2];
const contractPath = process.argv[3] ?? 'docs/contracts/graywake-shark-dcc-v1.json';
if (!modelPath) {
  console.error('Usage: node scripts/validate-shark-dcc.mjs MODEL.glb [CONTRACT.json]');
  process.exit(2);
}

try {
  const [bytes, contractText, modelStat] = await Promise.all([
    readFile(resolve(modelPath)),
    readFile(resolve(contractPath), 'utf8'),
    stat(resolve(modelPath)),
  ]);
  const contract = JSON.parse(contractText);
  const { document, binaryChunkBytes } = parseGlb(bytes);
  const result = validateSharkDccDocument(document, contract, {
    fileSize: modelStat.size,
    binaryChunkBytes,
  });
  console.log(JSON.stringify({
    status: result.failures.length === 0 ? 'passed' : 'failed',
    model: resolve(modelPath),
    contract: resolve(contractPath),
    ...result,
  }, null, 2));
  if (result.failures.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
