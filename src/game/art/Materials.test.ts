import { afterEach, describe, expect, it, vi } from 'vitest';
import { Texture, TextureLoader, type WebGLRenderer } from 'three';
import { loadAssetTextures } from './Materials';

describe('asset texture loading', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads each runtime texture once and preserves critical PBR bindings', async () => {
    const load = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(async (path) => {
      const texture = new Texture();
      texture.userData.sourcePath = path;
      return texture;
    });
    const renderer = {
      capabilities: { getMaxAnisotropy: () => 8 },
    } as unknown as WebGLRenderer;

    const textures = await loadAssetTextures(renderer);
    const paths = load.mock.calls.map(([path]) => path);

    expect(paths).toHaveLength(Object.keys(textures).length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(textures.fishEye.userData.sourcePath).toBe('/assets/textures/pelagic-fish-eye.webp');
    expect(textures.saltsealedGlove.userData.sourcePath).toBe('/assets/textures/saltsealed-glove.webp');
    expect(textures.signalLaminate.userData.sourcePath).toBe('/assets/textures/signal-laminate.webp');
    expect(textures.phosphorGlass.userData.sourcePath).toBe('/assets/textures/phosphor-glass.webp');
    expect(textures.stormClouds.userData.sourcePath).toBe('/assets/textures/storm-clouds.webp');
  });
});
