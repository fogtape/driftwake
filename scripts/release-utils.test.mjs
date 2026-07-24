import { describe, expect, it } from 'vitest';
import {
  collectRuntimePackages,
  findUndocumentedAssets,
  validateReleaseFiles,
  validateRuntimeRegistry,
} from './release-utils.mjs';

const packageLock = {
  packages: {
    '': { dependencies: { react: '^19', 'react-dom': '^19' } },
    'node_modules/react': { version: '19.0.0', license: 'MIT' },
    'node_modules/react-dom': { version: '19.0.0', license: 'MIT', dependencies: { scheduler: '^0.25' } },
    'node_modules/scheduler': { version: '0.25.0', license: 'MIT' },
  },
};

describe('release dependency inventory', () => {
  it('walks production dependencies and rejects missing or stale declarations', () => {
    const runtime = collectRuntimePackages(packageLock);
    expect(runtime.map((entry) => entry.name)).toEqual(['react', 'react-dom', 'scheduler']);
    expect(validateRuntimeRegistry(runtime, {
      schemaVersion: 1,
      packages: runtime.map((entry) => ({
        name: entry.name,
        license: entry.license,
        source: `https://example.test/${entry.name}`,
        noticeFile: 'LICENSE',
      })),
    })).toEqual([]);
    expect(validateRuntimeRegistry(runtime, {
      schemaVersion: 1,
      packages: [{ name: 'react', license: 'ISC', source: 'http://invalid.test', noticeFile: '' }],
    })).toEqual(expect.arrayContaining([
      expect.stringContaining('react license mismatch'),
      expect.stringContaining('react-dom'),
      expect.stringContaining('scheduler'),
    ]));
  });
});

describe('release asset and bundle gates', () => {
  it('requires every runtime asset and adopted source to be documented', () => {
    const files = ['public/assets/a.webp', 'artifacts/imagegen/a-raw.png', 'public/assets/missing.webp'];
    expect(findUndocumentedAssets(files, '`public/assets/a.webp` and `a-raw.png`')).toEqual([
      'public/assets/missing.webp',
    ]);
  });

  it('accepts split release chunks and rejects maps or budget growth', () => {
    const files = [
      { path: 'index.html', size: 500 },
      { path: 'THIRD_PARTY_NOTICES.txt', size: 4_000 },
      { path: 'assets/index-a.js', size: 20_000 },
      { path: 'assets/index-a.css', size: 5_000 },
      { path: 'assets/DriftwakeGame-a.js', size: 30_000 },
      { path: 'assets/rapier-a.js', size: 40_000 },
    ];
    expect(validateReleaseFiles(files).failures).toEqual([]);
    expect(validateReleaseFiles([
      ...files,
      { path: 'assets/index-a.js.map', size: 1 },
    ]).failures).toContain('release contains source maps');
    expect(validateReleaseFiles(files, {
      totalBytes: 10,
      entryJavaScriptBytes: 1,
      worldJavaScriptBytes: 1,
      physicsJavaScriptBytes: 1,
      cssBytes: 1,
    }).failures.length).toBe(5);
  });
});
