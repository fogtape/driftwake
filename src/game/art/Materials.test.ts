import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createMaterialLibrary, disposeMaterialLibrary } from './Materials';

describe('night-readable material library', () => {
  it('limits emissive night readability to first-person tool materials', () => {
    const wood = new Texture();
    const foam = new Texture();
    const library = createMaterialLibrary({ wood, foam });

    expect(library.metal.emissive.getHex()).toBe(0x000000);
    expect(library.rustMetal.emissive.getHex()).toBe(0x000000);
    expect(library.toolMetal.metalness).toBeLessThanOrEqual(0.4);
    expect(library.toolRustMetal.metalness).toBeLessThanOrEqual(0.35);
    expect(library.toolMetal.emissive.getHex()).not.toBe(0x000000);
    expect(library.toolRustMetal.emissive.getHex()).not.toBe(0x000000);
    expect(library.toolMetal.emissiveIntensity).toBeGreaterThanOrEqual(0.4);
    expect(library.toolRustMetal.emissiveIntensity).toBeGreaterThanOrEqual(0.3);

    disposeMaterialLibrary(library);
    wood.dispose();
    foam.dispose();
  });
});
