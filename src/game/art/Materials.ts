import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from 'three';

export interface AssetTextures {
  wood: Texture;
  foam: Texture;
  sharkSkin: Texture;
  sharkSkinNormal: Texture;
  sharkSkinRoughness: Texture;
  wovenFiber: Texture;
  wovenFiberNormal: Texture;
  wovenFiberRoughness: Texture;
  reefSeabed: Texture;
  reefSeabedNormal: Texture;
  reefSeabedRoughness: Texture;
}

export interface MaterialLibrary {
  wood: MeshStandardMaterial[];
  darkWood: MeshStandardMaterial;
  rope: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  rustMetal: MeshStandardMaterial;
  polymer: MeshStandardMaterial;
  leaf: MeshStandardMaterial;
  rock: MeshStandardMaterial;
  foliage: MeshStandardMaterial;
  wovenFiber: MeshStandardMaterial;
  sharkSkin: MeshStandardMaterial;
  sharkMouth: MeshStandardMaterial;
  sharkEye: MeshStandardMaterial;
  reefSeabed: MeshStandardMaterial;
  reefRock: MeshStandardMaterial;
  coralWarm: MeshStandardMaterial;
  coralPale: MeshStandardMaterial;
  seaweed: MeshStandardMaterial;
  ore: MeshStandardMaterial;
  clay: MeshStandardMaterial;
  reefFish: MeshStandardMaterial;
  reefCaustic: MeshBasicMaterial;
}

export async function loadAssetTextures(renderer: WebGLRenderer): Promise<AssetTextures> {
  const loader = new TextureLoader();
  const [
    wood,
    foam,
    sharkSkin,
    sharkSkinNormal,
    sharkSkinRoughness,
    wovenFiber,
    wovenFiberNormal,
    wovenFiberRoughness,
    reefSeabed,
    reefSeabedNormal,
    reefSeabedRoughness,
  ] = await Promise.all([
    loader.loadAsync('/assets/textures/weathered-cedar.webp'),
    loader.loadAsync('/assets/textures/ocean-foam-mask.png'),
    loader.loadAsync('/assets/textures/shark-skin.webp'),
    loader.loadAsync('/assets/textures/shark-skin-normal.webp'),
    loader.loadAsync('/assets/textures/shark-skin-roughness.webp'),
    loader.loadAsync('/assets/textures/woven-palm-fiber.webp'),
    loader.loadAsync('/assets/textures/woven-palm-fiber-normal.webp'),
    loader.loadAsync('/assets/textures/woven-palm-fiber-roughness.webp'),
    loader.loadAsync('/assets/textures/reef-seabed.webp'),
    loader.loadAsync('/assets/textures/reef-seabed-normal.webp'),
    loader.loadAsync('/assets/textures/reef-seabed-roughness.webp'),
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

  for (const texture of [sharkSkin, sharkSkinNormal, sharkSkinRoughness, wovenFiber, wovenFiberNormal, wovenFiberRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.anisotropy = anisotropy;
  }
  sharkSkin.colorSpace = SRGBColorSpace;
  wovenFiber.colorSpace = SRGBColorSpace;
  sharkSkinNormal.colorSpace = NoColorSpace;
  sharkSkinRoughness.colorSpace = NoColorSpace;
  wovenFiberNormal.colorSpace = NoColorSpace;
  wovenFiberRoughness.colorSpace = NoColorSpace;
  sharkSkin.repeat.set(1.15, 1.85);
  sharkSkinNormal.repeat.copy(sharkSkin.repeat);
  sharkSkinRoughness.repeat.copy(sharkSkin.repeat);
  wovenFiber.repeat.set(1.8, 1.8);
  wovenFiberNormal.repeat.copy(wovenFiber.repeat);
  wovenFiberRoughness.repeat.copy(wovenFiber.repeat);

  for (const texture of [reefSeabed, reefSeabedNormal, reefSeabedRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(3.2, 3.35);
    texture.anisotropy = anisotropy;
  }
  reefSeabed.colorSpace = SRGBColorSpace;
  reefSeabedNormal.colorSpace = NoColorSpace;
  reefSeabedRoughness.colorSpace = NoColorSpace;

  return {
    wood,
    foam,
    sharkSkin,
    sharkSkinNormal,
    sharkSkinRoughness,
    wovenFiber,
    wovenFiberNormal,
    wovenFiberRoughness,
    reefSeabed,
    reefSeabedNormal,
    reefSeabedRoughness,
  };
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
  const causticMap = textures.foam.clone();
  causticMap.repeat.set(9.5, 9.5);
  causticMap.rotation = 0.34;
  causticMap.needsUpdate = true;
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
    polymer: new MeshStandardMaterial({ color: 0x4b9aa3, roughness: 0.67, metalness: 0.0 }),
    leaf: new MeshStandardMaterial({ color: 0x718e55, roughness: 0.92, side: DoubleSide }),
    rock: new MeshStandardMaterial({ color: new Color('#766f62'), roughness: 0.96, flatShading: true }),
    foliage: new MeshStandardMaterial({ color: new Color('#54784f'), roughness: 0.92, flatShading: true }),
    wovenFiber: new MeshStandardMaterial({
      color: 0xe1c18c,
      map: textures.wovenFiber,
      normalMap: textures.wovenFiberNormal,
      normalScale: new Vector2(0.78, 0.78),
      roughnessMap: textures.wovenFiberRoughness,
      roughness: 1,
    }),
    sharkSkin: new MeshStandardMaterial({
      color: 0xc0d0ce,
      map: textures.sharkSkin,
      normalMap: textures.sharkSkinNormal,
      normalScale: new Vector2(0.48, 0.48),
      roughnessMap: textures.sharkSkinRoughness,
      roughness: 0.78,
      metalness: 0.0,
    }),
    sharkMouth: new MeshStandardMaterial({ color: 0x341f24, roughness: 0.84 }),
    sharkEye: new MeshStandardMaterial({ color: 0x090d0d, roughness: 0.22, metalness: 0.08 }),
    reefSeabed: new MeshStandardMaterial({
      color: 0xcbd0b5,
      map: textures.reefSeabed,
      normalMap: textures.reefSeabedNormal,
      normalScale: new Vector2(0.58, 0.58),
      roughnessMap: textures.reefSeabedRoughness,
      roughness: 0.94,
      metalness: 0,
    }),
    reefRock: new MeshStandardMaterial({ color: 0x667b70, roughness: 0.91, flatShading: true }),
    coralWarm: new MeshStandardMaterial({ color: 0xb85f50, roughness: 0.86, flatShading: true }),
    coralPale: new MeshStandardMaterial({ color: 0xd4c597, roughness: 0.9, flatShading: true }),
    seaweed: new MeshStandardMaterial({ color: 0x3f7657, roughness: 0.84, side: DoubleSide }),
    ore: new MeshStandardMaterial({ color: 0x5f8583, roughness: 0.52, metalness: 0.62, flatShading: true }),
    clay: new MeshStandardMaterial({ color: 0x9a584b, roughness: 1, flatShading: true }),
    reefFish: new MeshStandardMaterial({ color: 0x7ea4a2, roughness: 0.62, metalness: 0.08, flatShading: true }),
    reefCaustic: new MeshBasicMaterial({
      color: 0x8be6d8,
      alphaMap: causticMap,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    }),
  };
}

export function disposeMaterialLibrary(library: MaterialLibrary): void {
  for (const material of [
    ...library.wood,
    ...Object.values(library).filter((value) => value instanceof MeshStandardMaterial || value instanceof MeshBasicMaterial),
  ]) {
    if ('alphaMap' in material && material.alphaMap && material.alphaMap !== material.map) material.alphaMap.dispose();
    material.dispose();
  }
}
