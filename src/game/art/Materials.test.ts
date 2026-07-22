import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mesh, Texture, TextureLoader, type WebGLRenderer } from 'three';
import { createMaterialLibrary, loadAssetTextures } from './Materials';
import { createPlanterModel, createSaltwingBirdModel } from './PlantingModels';

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
    expect(textures.wood.userData.sourcePath).toBe('/assets/textures/weathered-cedar.webp');
    expect(textures.woodNormal.userData.sourcePath).toBe('/assets/textures/weathered-cedar-normal.webp');
    expect(textures.woodRoughness.userData.sourcePath).toBe('/assets/textures/weathered-cedar-roughness.webp');
    expect(textures.cookedFishFlesh.userData.sourcePath).toBe('/assets/textures/cooked-fish-flesh.webp');
    expect(textures.burntFishFlesh.userData.sourcePath).toBe('/assets/textures/burnt-fish-flesh.webp');
    expect(textures.saltfireIron.userData.sourcePath).toBe('/assets/textures/saltfire-folded-iron.webp');
    expect(textures.saltEtchedPolymer.userData.sourcePath).toBe('/assets/textures/salt-etched-polymer.webp');
    expect(textures.fishEye.userData.sourcePath).toBe('/assets/textures/pelagic-fish-eye.webp');
    expect(textures.tideboundRigging.userData.sourcePath).toBe('/assets/textures/tidebound-rigging.webp');
    expect(textures.brinewornToolSteel.userData.sourcePath).toBe('/assets/textures/brineworn-tool-steel.webp');
    expect(textures.cropLeaf.userData.sourcePath).toBe('/assets/textures/salt-crown-leaf.webp');
    expect(textures.cropDry.userData.sourcePath).toBe('/assets/textures/salt-crown-dry-leaf.webp');
    expect(textures.cropFruit.userData.sourcePath).toBe('/assets/textures/salt-crown-fruit.webp');
    expect(textures.birdFeather.userData.sourcePath).toBe('/assets/textures/saltwing-body-feather.webp');
    expect(textures.birdWing.userData.sourcePath).toBe('/assets/textures/saltwing-flight-feather.webp');
    expect(textures.birdBeak.userData.sourcePath).toBe('/assets/textures/saltwing-keratin.webp');
    expect(textures.birdEye.userData.sourcePath).toBe('/assets/textures/saltwing-eye.webp');
    expect(textures.saltsealedGlove.userData.sourcePath).toBe('/assets/textures/saltsealed-glove.webp');
    expect(textures.signalLaminate.userData.sourcePath).toBe('/assets/textures/signal-laminate.webp');
    expect(textures.phosphorGlass.userData.sourcePath).toBe('/assets/textures/phosphor-glass.webp');
    expect(textures.choirBronze.userData.sourcePath).toBe('/assets/textures/iron-choir-resonant-bronze.webp');
    expect(textures.stormCeramic.userData.sourcePath).toBe('/assets/textures/storm-needle-electret-ceramic.webp');
    expect(textures.stormClouds.userData.sourcePath).toBe('/assets/textures/storm-clouds.webp');

    const materials = createMaterialLibrary(textures);
    expect(materials.rope).toMatchObject({
      map: textures.tideboundRigging,
      normalMap: textures.tideboundRiggingNormal,
      roughnessMap: textures.tideboundRiggingRoughness,
    });
    expect(materials.metal).toMatchObject({
      map: textures.brinewornToolSteel,
      normalMap: textures.brinewornToolSteelNormal,
      roughnessMap: textures.brinewornToolSteelRoughness,
    });
    expect(materials.rustMetal.normalMap).toBe(textures.brinewornToolSteelNormal);
    expect(materials.polymer).toMatchObject({
      map: textures.saltEtchedPolymer,
      normalMap: textures.saltEtchedPolymerNormal,
      roughnessMap: textures.saltEtchedPolymerRoughness,
    });
    expect(materials.darkWood.normalMap).not.toBeNull();
    expect(materials.cropLeaf).toMatchObject({
      map: textures.cropLeaf,
      normalMap: textures.cropLeafNormal,
      roughnessMap: textures.cropLeafRoughness,
    });
    expect(materials.cropDry.map).toBe(textures.cropDry);
    expect(materials.cropFruit.map).toBe(textures.cropFruit);
    expect(materials.birdFeather.map).toBe(textures.birdFeather);
    expect(materials.birdWing.map).toBe(textures.birdWing);
    expect(materials.birdBeak.map).toBe(textures.birdBeak);
    expect(materials.birdEye.map).toBe(textures.birdEye);
    expect(materials.choirBronze).toMatchObject({
      map: textures.choirBronze,
      normalMap: textures.choirBronzeNormal,
      roughnessMap: textures.choirBronzeRoughness,
    });
    expect(materials.stormCeramic).toMatchObject({
      map: textures.stormCeramic,
      normalMap: textures.stormCeramicNormal,
      roughnessMap: textures.stormCeramicRoughness,
    });

    const planter = createPlanterModel(materials);
    const bird = createSaltwingBirdModel(materials);
    expect(planter.userData.materialMaps.split('|')).toHaveLength(9);
    expect(planter.userData.materialMaps).not.toContain('none');
    expect(bird.userData.materialMaps.split('|')).toHaveLength(12);
    expect(bird.userData.materialMaps).not.toContain('none');
    const leftEye = bird.getObjectByName('saltwing-eye-left');
    expect(leftEye).toBeInstanceOf(Mesh);
    expect((leftEye as Mesh).geometry.type).toBe('CircleGeometry');
    expect((leftEye as Mesh).material).toBe(materials.birdEye);
  });
});
