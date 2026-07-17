import {
  Color,
  DoubleSide,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  WebGLRenderer,
} from 'three';

export interface AssetTextures {
  wood: Texture;
  foam: Texture;
}

export interface MaterialLibrary {
  wood: MeshStandardMaterial[];
  darkWood: MeshStandardMaterial;
  rope: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  rustMetal: MeshStandardMaterial;
  toolMetal: MeshStandardMaterial;
  toolRustMetal: MeshStandardMaterial;
  polymer: MeshStandardMaterial;
  leaf: MeshStandardMaterial;
  rock: MeshStandardMaterial;
  foliage: MeshStandardMaterial;
}

export async function loadAssetTextures(renderer: WebGLRenderer): Promise<AssetTextures> {
  const loader = new TextureLoader();
  const [wood, foam] = await Promise.all([
    loader.loadAsync('/assets/textures/weathered-cedar.webp'),
    loader.loadAsync('/assets/textures/ocean-foam-mask.png'),
  ]);

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  wood.colorSpace = SRGBColorSpace;
  wood.wrapS = RepeatWrapping;
  wood.wrapT = RepeatWrapping;
  wood.repeat.set(1.35, 0.72);
  wood.anisotropy = anisotropy;

  foam.colorSpace = NoColorSpace;
  foam.wrapS = RepeatWrapping;
  foam.wrapT = RepeatWrapping;
  foam.anisotropy = anisotropy;

  return { wood, foam };
}

function woodVariant(source: Texture, color: number, offsetX: number): MeshStandardMaterial {
  const map = source.clone();
  map.offset.x = offsetX;
  map.needsUpdate = true;
  return new MeshStandardMaterial({
    color,
    map,
    bumpMap: map,
    bumpScale: 0.018,
    roughness: 0.88,
    metalness: 0.0,
  });
}

export function createMaterialLibrary(textures: AssetTextures): MaterialLibrary {
  return {
    wood: [
      woodVariant(textures.wood, 0xffffff, 0.0),
      woodVariant(textures.wood, 0xe7d2ae, 0.29),
      woodVariant(textures.wood, 0xc8d1c6, 0.61),
    ],
    darkWood: new MeshStandardMaterial({ color: 0x72513a, roughness: 0.96 }),
    rope: new MeshStandardMaterial({ color: 0xc49b63, roughness: 1.0 }),
    metal: new MeshStandardMaterial({ color: 0x8fa7a4, roughness: 0.58, metalness: 0.72 }),
    rustMetal: new MeshStandardMaterial({ color: 0x8f5742, roughness: 0.76, metalness: 0.58 }),
    toolMetal: new MeshStandardMaterial({
      color: 0x8fa7a4,
      roughness: 0.64,
      metalness: 0.38,
      emissive: 0x31515a,
      emissiveIntensity: 0.42,
    }),
    toolRustMetal: new MeshStandardMaterial({
      color: 0x8f5742,
      roughness: 0.8,
      metalness: 0.3,
      emissive: 0x4b271b,
      emissiveIntensity: 0.34,
    }),
    polymer: new MeshStandardMaterial({ color: 0x4b9aa3, roughness: 0.67, metalness: 0.0 }),
    leaf: new MeshStandardMaterial({ color: 0x718e55, roughness: 0.92, side: DoubleSide }),
    rock: new MeshStandardMaterial({ color: new Color('#766f62'), roughness: 0.96, flatShading: true }),
    foliage: new MeshStandardMaterial({ color: new Color('#54784f'), roughness: 0.92, flatShading: true }),
  };
}

export function disposeMaterialLibrary(library: MaterialLibrary): void {
  for (const material of [...library.wood, ...Object.values(library).filter((value) => value instanceof MeshStandardMaterial)]) {
    material.dispose();
  }
}

