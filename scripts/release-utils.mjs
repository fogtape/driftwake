export const RELEASE_BUDGETS = Object.freeze({
  totalBytes: 52 * 1024 * 1024,
  entryJavaScriptBytes: 460 * 1024,
  worldJavaScriptBytes: 1150 * 1024,
  physicsJavaScriptBytes: 2250 * 1024,
  cssBytes: 112 * 1024,
});

function resolveDependencyPackage(packages, parentKey, dependencyName) {
  const nested = parentKey ? `${parentKey}/node_modules/${dependencyName}` : null;
  const candidates = [nested, `node_modules/${dependencyName}`].filter(Boolean);
  return candidates.find((candidate) => packages[candidate]) ?? null;
}

export function collectRuntimePackages(packageLock) {
  const packages = packageLock?.packages;
  const root = packages?.[''];
  if (!packages || !root?.dependencies) throw new Error('package-lock runtime dependencies are unavailable');

  const queue = Object.keys(root.dependencies).map((name) => ({ name, parentKey: '' }));
  const visited = new Map();
  while (queue.length > 0) {
    const { name, parentKey } = queue.shift();
    const packageKey = resolveDependencyPackage(packages, parentKey, name);
    if (!packageKey) throw new Error(`runtime dependency ${name} is missing from package-lock`);
    if (visited.has(packageKey)) continue;
    const entry = packages[packageKey];
    if (!entry.version || !entry.license) throw new Error(`${name} lacks version or license metadata`);
    visited.set(packageKey, {
      name,
      version: entry.version,
      license: entry.license,
      packageKey,
    });
    for (const dependencyName of Object.keys({
      ...entry.dependencies,
      ...entry.optionalDependencies,
    })) {
      if (resolveDependencyPackage(packages, packageKey, dependencyName)) {
        queue.push({ name: dependencyName, parentKey: packageKey });
      }
    }
  }
  return [...visited.values()].sort((first, second) => first.name.localeCompare(second.name));
}

export function validateRuntimeRegistry(runtimePackages, registry) {
  const failures = [];
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.packages)) {
    return ['runtime dependency registry must use schemaVersion 1'];
  }
  const declared = new Map();
  for (const entry of registry.packages) {
    if (!entry?.name || declared.has(entry.name)) {
      failures.push(`duplicate or unnamed registry entry: ${entry?.name ?? '<missing>'}`);
      continue;
    }
    declared.set(entry.name, entry);
  }
  for (const dependency of runtimePackages) {
    const entry = declared.get(dependency.name);
    if (!entry) {
      failures.push(`undeclared runtime dependency: ${dependency.name}`);
      continue;
    }
    if (entry.license !== dependency.license) {
      failures.push(`${dependency.name} license mismatch: ${entry.license} != ${dependency.license}`);
    }
    if (!/^https:\/\//.test(entry.source ?? '')) failures.push(`${dependency.name} needs an HTTPS source`);
    if (!entry.noticeFile) failures.push(`${dependency.name} needs a noticeFile`);
  }
  for (const name of declared.keys()) {
    if (!runtimePackages.some((dependency) => dependency.name === name)) {
      failures.push(`stale runtime dependency declaration: ${name}`);
    }
  }
  return failures;
}

export function findUndocumentedAssets(files, manifestText) {
  return files.filter((file) => {
    const basename = file.split('/').at(-1);
    return !manifestText.includes(file) && !manifestText.includes(basename);
  });
}

export function validateReleaseFiles(files, budgets = RELEASE_BUDGETS) {
  const failures = [];
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  const selectOne = (label, pattern) => {
    const matches = files.filter((file) => pattern.test(file.path));
    if (matches.length !== 1) failures.push(`expected one ${label}, found ${matches.length}`);
    return matches[0] ? { path: matches[0].path, size: matches[0].size } : null;
  };
  const entry = selectOne('entry JavaScript chunk', /^assets\/index-[^/]+\.js$/);
  const world = selectOne('world JavaScript chunk', /^assets\/DriftwakeGame-[^/]+\.js$/);
  const physics = selectOne('physics JavaScript chunk', /^assets\/rapier-[^/]+\.js$/);
  const css = selectOne('application CSS chunk', /^assets\/index-[^/]+\.css$/);

  if (files.some((file) => file.path.endsWith('.map'))) failures.push('release contains source maps');
  if (!files.some((file) => file.path === 'THIRD_PARTY_NOTICES.txt')) failures.push('third-party notices are missing');
  if (!files.some((file) => file.path === 'index.html')) failures.push('release index.html is missing');
  if (totalBytes > budgets.totalBytes) failures.push(`release size ${totalBytes} exceeds ${budgets.totalBytes}`);
  for (const [label, file, limit] of [
    ['entry JavaScript', entry, budgets.entryJavaScriptBytes],
    ['world JavaScript', world, budgets.worldJavaScriptBytes],
    ['physics JavaScript', physics, budgets.physicsJavaScriptBytes],
    ['application CSS', css, budgets.cssBytes],
  ]) {
    if (file && file.size > limit) failures.push(`${label} size ${file.size} exceeds ${limit}`);
  }
  return {
    failures,
    totalBytes,
    chunks: { entry, world, physics, css },
  };
}
