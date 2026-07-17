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
  sailCloth: Texture;
  sailClothNormal: Texture;
  sailClothRoughness: Texture;
  planterSoil: Texture;
  planterSoilNormal: Texture;
  planterSoilRoughness: Texture;
  refractoryClay: Texture;
  refractoryClayNormal: Texture;
  refractoryClayRoughness: Texture;
  navigationAlloy: Texture;
  navigationAlloyNormal: Texture;
  navigationAlloyRoughness: Texture;
  saltglassCollector: Texture;
  saltglassCollectorNormal: Texture;
  saltglassCollectorRoughness: Texture;
  sealedCanvas: Texture;
  sealedCanvasNormal: Texture;
  sealedCanvasRoughness: Texture;
  stormClouds: Texture;
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
  sailCloth: MeshStandardMaterial;
  planterSoil: MeshStandardMaterial;
  refractoryClay: MeshStandardMaterial;
  navigationAlloy: MeshStandardMaterial;
  saltglassCollector: MeshStandardMaterial;
  sealedCanvas: MeshStandardMaterial;
  cropLeaf: MeshStandardMaterial;
  cropDry: MeshStandardMaterial;
  cropFruit: MeshStandardMaterial;
  birdFeather: MeshStandardMaterial;
  birdWing: MeshStandardMaterial;
  birdBeak: MeshStandardMaterial;
  birdEye: MeshStandardMaterial;
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
    sailCloth,
    sailClothNormal,
    sailClothRoughness,
    planterSoil,
    planterSoilNormal,
    planterSoilRoughness,
    refractoryClay,
    refractoryClayNormal,
    refractoryClayRoughness,
    navigationAlloy,
    navigationAlloyNormal,
    navigationAlloyRoughness,
    saltglassCollector,
    saltglassCollectorNormal,
    saltglassCollectorRoughness,
    sealedCanvas,
    sealedCanvasNormal,
    sealedCanvasRoughness,
    stormClouds,
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
    loader.loadAsync('/assets/textures/sail-cloth.webp'),
    loader.loadAsync('/assets/textures/sail-cloth-normal.webp'),
    loader.loadAsync('/assets/textures/sail-cloth-roughness.webp'),
    loader.loadAsync('/assets/textures/planter-soil.webp'),
    loader.loadAsync('/assets/textures/planter-soil-normal.webp'),
    loader.loadAsync('/assets/textures/planter-soil-roughness.webp'),
    loader.loadAsync('/assets/textures/refractory-clay.webp'),
    loader.loadAsync('/assets/textures/refractory-clay-normal.webp'),
    loader.loadAsync('/assets/textures/refractory-clay-roughness.webp'),
    loader.loadAsync('/assets/textures/navigation-alloy.webp'),
    loader.loadAsync('/assets/textures/navigation-alloy-normal.webp'),
    loader.loadAsync('/assets/textures/navigation-alloy-roughness.webp'),
    loader.loadAsync('/assets/textures/saltglass-collector.webp'),
    loader.loadAsync('/assets/textures/saltglass-collector-normal.webp'),
    loader.loadAsync('/assets/textures/saltglass-collector-roughness.webp'),
    loader.loadAsync('/assets/textures/sealed-canvas.webp'),
    loader.loadAsync('/assets/textures/sealed-canvas-normal.webp'),
    loader.loadAsync('/assets/textures/sealed-canvas-roughness.webp'),
    loader.loadAsync('/assets/textures/storm-clouds.webp'),
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

  for (const texture of [sailCloth, sailClothNormal, sailClothRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.anisotropy = anisotropy;
  }
  sailCloth.colorSpace = SRGBColorSpace;
  sailClothNormal.colorSpace = NoColorSpace;
  sailClothRoughness.colorSpace = NoColorSpace;

  for (const texture of [planterSoil, planterSoilNormal, planterSoilRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.35, 1.1);
    texture.anisotropy = anisotropy;
  }
  planterSoil.colorSpace = SRGBColorSpace;
  planterSoilNormal.colorSpace = NoColorSpace;
  planterSoilRoughness.colorSpace = NoColorSpace;

  for (const texture of [refractoryClay, refractoryClayNormal, refractoryClayRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.55, 1.35);
    texture.anisotropy = anisotropy;
  }
  refractoryClay.colorSpace = SRGBColorSpace;
  refractoryClayNormal.colorSpace = NoColorSpace;
  refractoryClayRoughness.colorSpace = NoColorSpace;

  for (const texture of [navigationAlloy, navigationAlloyNormal, navigationAlloyRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.7, 1.45);
    texture.anisotropy = anisotropy;
  }
  navigationAlloy.colorSpace = SRGBColorSpace;
  navigationAlloyNormal.colorSpace = NoColorSpace;
  navigationAlloyRoughness.colorSpace = NoColorSpace;

  for (const texture of [saltglassCollector, saltglassCollectorNormal, saltglassCollectorRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.35, 1.15);
    texture.anisotropy = anisotropy;
  }
  saltglassCollector.colorSpace = SRGBColorSpace;
  saltglassCollectorNormal.colorSpace = NoColorSpace;
  saltglassCollectorRoughness.colorSpace = NoColorSpace;

  for (const texture of [sealedCanvas, sealedCanvasNormal, sealedCanvasRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.5, 1.35);
    texture.anisotropy = anisotropy;
  }
  sealedCanvas.colorSpace = SRGBColorSpace;
  sealedCanvasNormal.colorSpace = NoColorSpace;
  sealedCanvasRoughness.colorSpace = NoColorSpace;

  stormClouds.colorSpace = SRGBColorSpace;
  stormClouds.wrapS = RepeatWrapping;
  stormClouds.wrapT = RepeatWrapping;
  stormClouds.repeat.set(2, 1);
  stormClouds.anisotropy = anisotropy;

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
    sailCloth,
    sailClothNormal,
    sailClothRoughness,
    planterSoil,
    planterSoilNormal,
    planterSoilRoughness,
    refractoryClay,
    refractoryClayNormal,
    refractoryClayRoughness,
    navigationAlloy,
    navigationAlloyNormal,
    navigationAlloyRoughness,
    saltglassCollector,
    saltglassCollectorNormal,
    saltglassCollectorRoughness,
    sealedCanvas,
    sealedCanvasNormal,
    sealedCanvasRoughness,
    stormClouds,
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
    sailCloth: new MeshStandardMaterial({
      color: 0xe7dcc2,
      map: textures.sailCloth,
      normalMap: textures.sailClothNormal,
      normalScale: new Vector2(0.62, 0.62),
      roughnessMap: textures.sailClothRoughness,
      roughness: 0.96,
      metalness: 0,
      side: DoubleSide,
    }),
    planterSoil: new MeshStandardMaterial({
      color: 0xb6aa8d,
      map: textures.planterSoil,
      normalMap: textures.planterSoilNormal,
      normalScale: new Vector2(0.48, 0.48),
      roughnessMap: textures.planterSoilRoughness,
      roughness: 1,
      metalness: 0,
    }),
    refractoryClay: new MeshStandardMaterial({
      color: 0xd4a28a,
      map: textures.refractoryClay,
      normalMap: textures.refractoryClayNormal,
      normalScale: new Vector2(0.56, 0.56),
      roughnessMap: textures.refractoryClayRoughness,
      roughness: 0.94,
      metalness: 0,
    }),
    navigationAlloy: new MeshStandardMaterial({
      color: 0xc5b486,
      map: textures.navigationAlloy,
      normalMap: textures.navigationAlloyNormal,
      normalScale: new Vector2(0.46, 0.46),
      roughnessMap: textures.navigationAlloyRoughness,
      roughness: 0.66,
      metalness: 0.76,
    }),
    saltglassCollector: new MeshStandardMaterial({
      color: 0xd8f2e9,
      map: textures.saltglassCollector,
      normalMap: textures.saltglassCollectorNormal,
      normalScale: new Vector2(0.36, 0.36),
      roughnessMap: textures.saltglassCollectorRoughness,
      roughness: 0.46,
      metalness: 0.06,
    }),
    sealedCanvas: new MeshStandardMaterial({
      color: 0xb8cfca,
      map: textures.sealedCanvas,
      normalMap: textures.sealedCanvasNormal,
      normalScale: new Vector2(0.72, 0.72),
      roughnessMap: textures.sealedCanvasRoughness,
      roughness: 0.98,
      metalness: 0,
      side: DoubleSide,
    }),
    cropLeaf: new MeshStandardMaterial({ color: 0x5f8c54, roughness: 0.86, side: DoubleSide }),
    cropDry: new MeshStandardMaterial({ color: 0x9b7750, roughness: 0.98, side: DoubleSide }),
    cropFruit: new MeshStandardMaterial({ color: 0xb6c65f, roughness: 0.76, flatShading: true }),
    birdFeather: new MeshStandardMaterial({ color: 0xb8c4bc, roughness: 0.82, flatShading: true }),
    birdWing: new MeshStandardMaterial({ color: 0x536f70, roughness: 0.88, side: DoubleSide, flatShading: true }),
    birdBeak: new MeshStandardMaterial({ color: 0xd39a55, roughness: 0.78, flatShading: true }),
    birdEye: new MeshStandardMaterial({ color: 0x111716, roughness: 0.24 }),
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
