import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectRuntimePackages,
  findUndocumentedAssets,
  validateReleaseFiles,
  validateRuntimeRegistry,
} from './release-utils.mjs';
import {
  parseGlb,
  validateSharkDccContractDefinition,
  validateSharkDccDocument,
} from './shark-dcc-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = resolve(root, 'dist');
const artifactDirectory = resolve(root, 'artifacts/release');
const contextEvidencePath = resolve(artifactDirectory, 'context-lifecycle.json');
const audioMixEvidencePath = resolve(artifactDirectory, 'audio-mix-lifecycle.json');
const sharkDccContractPath = resolve(root, 'docs/contracts/graywake-shark-dcc-v1.json');
const sharkDccModelPath = resolve(root, 'public/assets/models/graywake-shark.glb');
const sharkGingivaSourcePath = resolve(root, 'artifacts/imagegen/graywake-gingiva-raw.png');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
const registry = JSON.parse(await readFile(resolve(root, 'release/runtime-dependencies.json'), 'utf8'));
const assetManifest = await readFile(resolve(root, 'docs/ASSET_MANIFEST.md'), 'utf8');
const sharkDccContract = JSON.parse(await readFile(sharkDccContractPath, 'utf8'));
const gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const gitStatus = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const steps = [];
const failures = [];
let assetSummary = null;
let dependencySummary = null;
let bundleSummary = null;
let contextLifecycle = null;
let audioMixLifecycle = null;
let sharkDccSummary = null;

async function walkFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((first, second) => first.name.localeCompare(second.name))) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(absolute, base));
    else if (entry.isFile()) {
      files.push({
        absolute,
        path: relative(base, absolute).split(sep).join('/'),
        size: (await stat(absolute)).size,
      });
    }
  }
  return files;
}

function runCommand(label, command, args, { env = {}, timeoutMs = 300_000 } = {}) {
  const startedAt = Date.now();
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolvePromise({ durationMs: Date.now() - startedAt });
      } else {
        reject(new Error(`${label} exited with ${signal ?? code}`));
      }
    });
  });
}

async function runStep(name, action) {
  const startedAt = Date.now();
  try {
    const detail = await action();
    steps.push({ name, status: 'passed', durationMs: Date.now() - startedAt, detail: detail ?? null });
    return detail;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    steps.push({ name, status: 'failed', durationMs: Date.now() - startedAt, detail: message });
    failures.push(`${name}: ${message}`);
    return null;
  }
}

function requireNoFailures(label, gateFailures) {
  if (gateFailures.length > 0) throw new Error(`${label}: ${gateFailures.join(' | ')}`);
}

async function buildThirdPartyNotices(runtimePackages) {
  const declarations = new Map(registry.packages.map((entry) => [entry.name, entry]));
  const sections = [
    'Driftwake Third-Party Notices',
    `Candidate version: ${packageJson.version}`,
    '',
    'This file is generated from package-lock.json and release/runtime-dependencies.json.',
    '',
  ];
  const markers = {
    'Apache-2.0': 'Apache License',
    'OFL-1.1': 'SIL OPEN FONT LICENSE',
    ISC: 'ISC License',
    MIT: 'Permission is hereby granted',
  };
  for (const dependency of runtimePackages) {
    const declaration = declarations.get(dependency.name);
    const noticePath = resolve(root, declaration.noticeFile);
    const licenseText = (await readFile(noticePath, 'utf8')).trim();
    const marker = markers[dependency.license];
    if (licenseText.length < 200 || (marker && !licenseText.includes(marker))) {
      throw new Error(`${dependency.name} notice does not contain the expected ${dependency.license} text`);
    }
    sections.push(
      '='.repeat(78),
      `${dependency.name}@${dependency.version}`,
      `License: ${dependency.license}`,
      `Source: ${declaration.source}`,
      `Purpose: ${declaration.purpose}`,
      '',
      licenseText,
      '',
    );
  }
  await writeFile(resolve(distDirectory, 'THIRD_PARTY_NOTICES.txt'), `${sections.join('\n')}\n`, 'utf8');
}

async function hashFile(file) {
  const data = await readFile(file.absolute);
  return { path: file.path, bytes: file.size, sha256: createHash('sha256').update(data).digest('hex') };
}

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.wasm', 'application/wasm'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
      const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      let absolute = resolve(distDirectory, requested);
      if (absolute !== distDirectory && !absolute.startsWith(`${distDirectory}${sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      let fileStat = await stat(absolute).catch(() => null);
      if (!fileStat?.isFile() && !extname(requested)) {
        absolute = resolve(distDirectory, 'index.html');
        fileStat = await stat(absolute);
      }
      if (!fileStat?.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': mimeTypes.get(extname(absolute)) ?? 'application/octet-stream',
      });
      response.end(await readFile(absolute));
    } catch (error) {
      response.writeHead(500).end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('release server did not bind a TCP port');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise())),
  };
}

await mkdir(artifactDirectory, { recursive: true });

await runStep('unit-and-domain-tests', () => runCommand(
  'tests',
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['test', '--', '--maxWorkers=1', '--reporter=dot'],
));

await runStep('release-build', () => runCommand(
  'release build',
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'build:release'],
));

await runStep('asset-provenance', async () => {
  const runtimeAssets = (await walkFiles(resolve(root, 'public/assets'), root)).map((file) => file.path);
  const adoptedSources = (await walkFiles(resolve(root, 'artifacts/imagegen'), root))
    .map((file) => file.path)
    .filter((file) => file.endsWith('-raw.png'));
  const undocumented = findUndocumentedAssets([...runtimeAssets, ...adoptedSources], assetManifest);
  const explicitPaths = [...new Set([...assetManifest.matchAll(/public\/assets\/[A-Za-z0-9._/-]+/g)].map((match) => match[0]))];
  const missing = [];
  for (const file of explicitPaths) {
    if (!await stat(resolve(root, file)).catch(() => null)) missing.push(file);
  }
  requireNoFailures('asset provenance gate', [
    ...undocumented.map((file) => `undocumented ${file}`),
    ...missing.map((file) => `missing ${file}`),
  ]);
  assetSummary = {
    runtimeAssets: runtimeAssets.length,
    adoptedSources: adoptedSources.length,
    explicitManifestPaths: explicitPaths.length,
    undocumented: undocumented.length,
    missing: missing.length,
  };
  return assetSummary;
});

await runStep('shark-dcc-readiness', async () => {
  requireNoFailures('shark DCC contract definition', validateSharkDccContractDefinition(sharkDccContract));
  const modelStat = await stat(sharkDccModelPath).catch(() => null);
  if (!modelStat?.isFile()) {
    sharkDccSummary = {
      status: 'pending-dcc-delivery',
      contractVersion: sharkDccContract.schemaVersion,
      modelPath: relative(root, sharkDccModelPath).split(sep).join('/'),
    };
    return sharkDccSummary;
  }
  const bytes = await readFile(sharkDccModelPath);
  const { document, binaryChunkBytes } = parseGlb(bytes);
  const result = validateSharkDccDocument(document, sharkDccContract, {
    fileSize: modelStat.size,
    binaryChunkBytes,
  });
  requireNoFailures('shark DCC asset', result.failures);
  sharkDccSummary = { status: 'validated', ...result.summary };
  return sharkDccSummary;
});

await runStep('runtime-license-inventory', async () => {
  const runtimePackages = collectRuntimePackages(packageLock);
  requireNoFailures('runtime license registry', validateRuntimeRegistry(runtimePackages, registry));
  for (const declaration of registry.packages) {
    if (!await stat(resolve(root, declaration.noticeFile)).catch(() => null)) {
      throw new Error(`${declaration.name} notice file is missing: ${declaration.noticeFile}`);
    }
  }
  await buildThirdPartyNotices(runtimePackages);
  dependencySummary = runtimePackages.map(({ name, version, license }) => ({ name, version, license }));
  return { packages: dependencySummary.length };
});

await runStep('bundle-integrity-and-budgets', async () => {
  const html = await readFile(resolve(distDirectory, 'index.html'), 'utf8');
  if (/https?:\/\//i.test(html)) throw new Error('release HTML contains a remote URL');
  if (/DriftwakeGame|rapier/i.test(html)) throw new Error('world runtime is eagerly linked from release HTML');
  const beforeManifest = await walkFiles(distDirectory, distDirectory);
  for (const file of beforeManifest.filter((entry) => /\.(?:css|js)$/.test(entry.path))) {
    const source = await readFile(file.absolute, 'utf8');
    if (source.includes('sourceMappingURL')) throw new Error(`${file.path} exposes a source map reference`);
  }
  const checksumFiles = await Promise.all(beforeManifest.map(hashFile));
  await writeFile(resolve(distDirectory, 'release-manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    name: packageJson.name,
    version: packageJson.version,
    commit: gitCommit,
    files: checksumFiles,
  }, null, 2)}\n`, 'utf8');
  const releaseFiles = await walkFiles(distDirectory, distDirectory);
  bundleSummary = validateReleaseFiles(releaseFiles);
  requireNoFailures('bundle gate', bundleSummary.failures);
  return {
    files: releaseFiles.length,
    totalBytes: bundleSummary.totalBytes,
    chunks: bundleSummary.chunks,
    sourceMaps: 0,
  };
});

await runStep('production-context-lifecycle', async () => {
  if (process.env.RELEASE_SKIP_BROWSER === '1') throw new Error('browser lifecycle gate was explicitly skipped');
  const server = await startStaticServer();
  try {
    await runCommand('production context lifecycle', process.execPath, ['scripts/m1-regression.mjs'], {
      env: {
        DRIFTWAKE_URL: server.url,
        M1_REAL_CONTEXT_LOSS: '1',
        M1_EVIDENCE_PATH: contextEvidencePath,
      },
      timeoutMs: 360_000,
    });
  } finally {
    await server.close();
  }
  contextLifecycle = JSON.parse(await readFile(contextEvidencePath, 'utf8'));
  requireNoFailures('context lifecycle evidence', [
    contextLifecycle.contextMode !== 'extension' ? 'context loss did not use WEBGL_lose_context' : null,
    contextLifecycle.titleGate?.canvasFound ? 'title page created a canvas' : null,
    contextLifecycle.titleGate?.worldLoaded ? 'title page loaded the world runtime' : null,
    contextLifecycle.finalState?.contextLost ? 'context remained lost' : null,
    contextLifecycle.finalState?.simulationActive !== 'true' ? 'simulation did not resume' : null,
    contextLifecycle.externalResources?.length > 0 ? 'runtime used external resources' : null,
  ].filter(Boolean));
  return {
    mode: contextLifecycle.contextMode,
    rendererMode: contextLifecycle.rendererMode,
    renderer: contextLifecycle.renderer,
    finalFrame: {
      variation: contextLifecycle.finalState.variation,
      nonBlack: contextLifecycle.finalState.nonBlack,
    },
  };
});

await runStep('production-audio-mix-lifecycle', async () => {
  if (process.env.RELEASE_SKIP_BROWSER === '1') throw new Error('browser audio mix gate was explicitly skipped');
  const server = await startStaticServer();
  try {
    await runCommand('production audio mix lifecycle', process.execPath, ['scripts/audio-mix-regression.mjs'], {
      env: {
        DRIFTWAKE_URL: server.url,
        AUDIO_MIX_EVIDENCE_PATH: audioMixEvidencePath,
      },
      timeoutMs: 180_000,
    });
  } finally {
    await server.close();
  }
  audioMixLifecycle = JSON.parse(await readFile(audioMixEvidencePath, 'utf8'));
  requireNoFailures('audio mix lifecycle evidence', [
    audioMixLifecycle.status !== 'passed' ? 'audio mix browser probe did not pass' : null,
    !audioMixLifecycle.running?.graphReady ? 'six-bus audio graph was not ready' : null,
    audioMixLifecycle.running?.contextState !== 'running' ? 'audio context did not enter running state' : null,
    !audioMixLifecycle.running?.limiter?.ready ? 'mastering limiter was not ready' : null,
    audioMixLifecycle.muted?.masterTargetGain !== 0 ? 'focus mute did not target silence on the master bus' : null,
    audioMixLifecycle.resumed?.masterTargetGain !== 0.78 ? 'master bus did not restore its configured target gain' : null,
    audioMixLifecycle.errors?.length > 0 ? 'audio browser probe reported errors' : null,
  ].filter(Boolean));
  return {
    graphReady: audioMixLifecycle.running.graphReady,
    contextState: audioMixLifecycle.running.contextState,
    limiter: audioMixLifecycle.running.limiter,
    focusMuteTargetGain: audioMixLifecycle.muted.masterTargetGain,
    resumedTargetGain: audioMixLifecycle.resumed.masterTargetGain,
  };
});

if (process.env.RELEASE_REQUIRE_CLEAN === '1' && gitStatus) {
  failures.push(`clean-worktree: tracked or untracked files are present: ${gitStatus.replaceAll('\n', ' | ')}`);
}

const renderer = contextLifecycle?.renderer ?? '';
const softwareRenderer = /swiftshader|llvmpipe|lavapipe|software/i.test(renderer)
  || contextLifecycle?.rendererMode === 'swiftshader';
const sharkGingivaSourceExists = Boolean(await stat(sharkGingivaSourcePath).catch(() => null));
const contentGates = {
  sharkDcc: sharkDccSummary?.status ?? 'contract-check-failed',
  sharkGingivaImage2: sharkGingivaSourceExists
    ? 'source-present-requires-adoption-validation'
    : 'pending-image-2-source',
};
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  candidate: { name: packageJson.name, version: packageJson.version, commit: gitCommit, clean: !gitStatus },
  status: failures.length === 0 ? 'passed' : 'failed',
  steps,
  assets: assetSummary,
  runtimeDependencies: dependencySummary,
  bundle: bundleSummary ? {
    totalBytes: bundleSummary.totalBytes,
    chunks: bundleSummary.chunks,
  } : null,
  contextLifecycle,
  audioMixLifecycle,
  contentGates,
  externalGates: {
    targetGpuProfiles: softwareRenderer ? 'pending-real-gpu' : 'requires-profile-review',
    twentyMinuteStability: 'pending-target-gpu',
    noInstructionPlayers: 'pending-external-participants',
    projectReleaseLicense: 'pending-owner-decision',
  },
  failures,
};
const reportText = `${JSON.stringify(report, null, 2)}\n`;
await Promise.all([
  writeFile(resolve(artifactDirectory, `candidate-${runId}.json`), reportText, 'utf8'),
  writeFile(resolve(artifactDirectory, 'latest.json'), reportText, 'utf8'),
]);
console.log(JSON.stringify({
  status: report.status,
  version: packageJson.version,
  commit: gitCommit,
  assetSummary,
  runtimePackages: dependencySummary?.length ?? 0,
  bundleBytes: bundleSummary?.totalBytes ?? null,
  contextMode: contextLifecycle?.contextMode ?? null,
  renderer: contextLifecycle?.renderer ?? null,
  contentGates,
  externalGates: report.externalGates,
  failures,
}, null, 2));
console.log(`Release evidence: ${resolve(artifactDirectory, 'latest.json')}`);
if (failures.length > 0) process.exitCode = 1;
