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
  silverSpineSkin: Texture;
  silverSpineSkinNormal: Texture;
  silverSpineSkinRoughness: Texture;
  amberFinSkin: Texture;
  amberFinSkinNormal: Texture;
  amberFinSkinRoughness: Texture;
  sailtailRunnerSkin: Texture;
  sailtailRunnerSkinNormal: Texture;
  sailtailRunnerSkinRoughness: Texture;
  fishFlesh: Texture;
  fishFleshNormal: Texture;
  fishFleshRoughness: Texture;
  cookedFishFlesh: Texture;
  cookedFishFleshNormal: Texture;
  cookedFishFleshRoughness: Texture;
  burntFishFlesh: Texture;
  burntFishFleshNormal: Texture;
  burntFishFleshRoughness: Texture;
  saltfireIron: Texture;
  saltfireIronNormal: Texture;
  saltfireIronRoughness: Texture;
  saltEtchedPolymer: Texture;
  saltEtchedPolymerNormal: Texture;
  saltEtchedPolymerRoughness: Texture;
  fishEye: Texture;
  fishEyeNormal: Texture;
  fishEyeRoughness: Texture;
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
  saltsealedGlove: Texture;
  saltsealedGloveNormal: Texture;
  saltsealedGloveRoughness: Texture;
  signalLaminate: Texture;
  signalLaminateNormal: Texture;
  signalLaminateRoughness: Texture;
  phosphorGlass: Texture;
  phosphorGlassNormal: Texture;
  phosphorGlassRoughness: Texture;
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
  silverSpineSkin: MeshStandardMaterial;
  amberFinSkin: MeshStandardMaterial;
  sailtailRunnerSkin: MeshStandardMaterial;
  fishFlesh: MeshStandardMaterial;
  cookedFishFlesh: MeshStandardMaterial;
  burntFishFlesh: MeshStandardMaterial;
  saltfireIron: MeshStandardMaterial;
  saltEtchedPolymer: MeshStandardMaterial;
  fishEye: MeshStandardMaterial;
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
  saltsealedGlove: MeshStandardMaterial;
  signalLaminate: MeshStandardMaterial;
  phosphorGlass: MeshStandardMaterial;
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
    silverSpineSkin,
    silverSpineSkinNormal,
    silverSpineSkinRoughness,
    amberFinSkin,
    amberFinSkinNormal,
    amberFinSkinRoughness,
    sailtailRunnerSkin,
    sailtailRunnerSkinNormal,
    sailtailRunnerSkinRoughness,
    fishFlesh,
    fishFleshNormal,
    fishFleshRoughness,
    cookedFishFlesh,
    cookedFishFleshNormal,
    cookedFishFleshRoughness,
    burntFishFlesh,
    burntFishFleshNormal,
    burntFishFleshRoughness,
    saltfireIron,
    saltfireIronNormal,
    saltfireIronRoughness,
    saltEtchedPolymer,
    saltEtchedPolymerNormal,
    saltEtchedPolymerRoughness,
    fishEye,
    fishEyeNormal,
    fishEyeRoughness,
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
    saltsealedGlove,
    saltsealedGloveNormal,
    saltsealedGloveRoughness,
    signalLaminate,
    signalLaminateNormal,
    signalLaminateRoughness,
    phosphorGlass,
    phosphorGlassNormal,
    phosphorGlassRoughness,
    stormClouds,
  ] = await Promise.all([
    loader.loadAsync('/assets/textures/weathered-cedar.webp'),
    loader.loadAsync('/assets/textures/ocean-foam-mask.png'),
    loader.loadAsync('/assets/textures/shark-skin.webp'),
    loader.loadAsync('/assets/textures/shark-skin-normal.webp'),
    loader.loadAsync('/assets/textures/shark-skin-roughness.webp'),
    loader.loadAsync('/assets/textures/silver-spine-skin.webp'),
    loader.loadAsync('/assets/textures/silver-spine-skin-normal.webp'),
    loader.loadAsync('/assets/textures/silver-spine-skin-roughness.webp'),
    loader.loadAsync('/assets/textures/amber-fin-skin.webp'),
    loader.loadAsync('/assets/textures/amber-fin-skin-normal.webp'),
    loader.loadAsync('/assets/textures/amber-fin-skin-roughness.webp'),
    loader.loadAsync('/assets/textures/sailtail-runner-skin.webp'),
    loader.loadAsync('/assets/textures/sailtail-runner-skin-normal.webp'),
    loader.loadAsync('/assets/textures/sailtail-runner-skin-roughness.webp'),
    loader.loadAsync('/assets/textures/fresh-fish-flesh.webp'),
    loader.loadAsync('/assets/textures/fresh-fish-flesh-normal.webp'),
    loader.loadAsync('/assets/textures/fresh-fish-flesh-roughness.webp'),
    loader.loadAsync('/assets/textures/cooked-fish-flesh.webp'),
    loader.loadAsync('/assets/textures/cooked-fish-flesh-normal.webp'),
    loader.loadAsync('/assets/textures/cooked-fish-flesh-roughness.webp'),
    loader.loadAsync('/assets/textures/burnt-fish-flesh.webp'),
    loader.loadAsync('/assets/textures/burnt-fish-flesh-normal.webp'),
    loader.loadAsync('/assets/textures/burnt-fish-flesh-roughness.webp'),
    loader.loadAsync('/assets/textures/saltfire-folded-iron.webp'),
    loader.loadAsync('/assets/textures/saltfire-folded-iron-normal.webp'),
    loader.loadAsync('/assets/textures/saltfire-folded-iron-roughness.webp'),
    loader.loadAsync('/assets/textures/salt-etched-polymer.webp'),
    loader.loadAsync('/assets/textures/salt-etched-polymer-normal.webp'),
    loader.loadAsync('/assets/textures/salt-etched-polymer-roughness.webp'),
    loader.loadAsync('/assets/textures/pelagic-fish-eye.webp'),
    loader.loadAsync('/assets/textures/pelagic-fish-eye-normal.webp'),
    loader.loadAsync('/assets/textures/pelagic-fish-eye-roughness.webp'),
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
    loader.loadAsync('/assets/textures/saltsealed-glove.webp'),
    loader.loadAsync('/assets/textures/saltsealed-glove-normal.webp'),
    loader.loadAsync('/assets/textures/saltsealed-glove-roughness.webp'),
    loader.loadAsync('/assets/textures/signal-laminate.webp'),
    loader.loadAsync('/assets/textures/signal-laminate-normal.webp'),
    loader.loadAsync('/assets/textures/signal-laminate-roughness.webp'),
    loader.loadAsync('/assets/textures/phosphor-glass.webp'),
    loader.loadAsync('/assets/textures/phosphor-glass-normal.webp'),
    loader.loadAsync('/assets/textures/phosphor-glass-roughness.webp'),
    loader.loadAsync('/assets/textures/storm-clouds.webp'),
  ]);

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textureNames: Array<[Texture, string]> = [
    [silverSpineSkin, 'silver-spine-skin-albedo'],
    [silverSpineSkinNormal, 'silver-spine-skin-normal'],
    [silverSpineSkinRoughness, 'silver-spine-skin-roughness'],
    [amberFinSkin, 'amber-fin-skin-albedo'],
    [amberFinSkinNormal, 'amber-fin-skin-normal'],
    [amberFinSkinRoughness, 'amber-fin-skin-roughness'],
    [sailtailRunnerSkin, 'sailtail-runner-skin-albedo'],
    [sailtailRunnerSkinNormal, 'sailtail-runner-skin-normal'],
    [sailtailRunnerSkinRoughness, 'sailtail-runner-skin-roughness'],
    [fishFlesh, 'fresh-fish-flesh-albedo'],
    [fishFleshNormal, 'fresh-fish-flesh-normal'],
    [fishFleshRoughness, 'fresh-fish-flesh-roughness'],
    [cookedFishFlesh, 'cooked-fish-flesh-albedo'],
    [cookedFishFleshNormal, 'cooked-fish-flesh-normal'],
    [cookedFishFleshRoughness, 'cooked-fish-flesh-roughness'],
    [burntFishFlesh, 'burnt-fish-flesh-albedo'],
    [burntFishFleshNormal, 'burnt-fish-flesh-normal'],
    [burntFishFleshRoughness, 'burnt-fish-flesh-roughness'],
    [saltfireIron, 'saltfire-folded-iron-albedo'],
    [saltfireIronNormal, 'saltfire-folded-iron-normal'],
    [saltfireIronRoughness, 'saltfire-folded-iron-roughness'],
    [saltEtchedPolymer, 'salt-etched-polymer-albedo'],
    [saltEtchedPolymerNormal, 'salt-etched-polymer-normal'],
    [saltEtchedPolymerRoughness, 'salt-etched-polymer-roughness'],
    [fishEye, 'pelagic-fish-eye-albedo'],
    [fishEyeNormal, 'pelagic-fish-eye-normal'],
    [fishEyeRoughness, 'pelagic-fish-eye-roughness'],
  ];
  textureNames.forEach(([texture, name]) => {
    texture.name = name;
  });
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

  const fishSkinSets = [
    [silverSpineSkin, silverSpineSkinNormal, silverSpineSkinRoughness],
    [amberFinSkin, amberFinSkinNormal, amberFinSkinRoughness],
    [sailtailRunnerSkin, sailtailRunnerSkinNormal, sailtailRunnerSkinRoughness],
  ];
  for (const textureSet of fishSkinSets) {
    for (const texture of textureSet) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.center.set(0.5, 0.5);
      texture.rotation = Math.PI / 2;
      texture.repeat.set(1.12, 1.06);
      texture.anisotropy = anisotropy;
    }
    textureSet[0].colorSpace = SRGBColorSpace;
    textureSet[1].colorSpace = NoColorSpace;
    textureSet[2].colorSpace = NoColorSpace;
  }
  const fishFleshSets = [
    [fishFlesh, fishFleshNormal, fishFleshRoughness],
    [cookedFishFlesh, cookedFishFleshNormal, cookedFishFleshRoughness],
    [burntFishFlesh, burntFishFleshNormal, burntFishFleshRoughness],
  ];
  for (const textureSet of fishFleshSets) {
    for (const texture of textureSet) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(1.35, 1.25);
      texture.anisotropy = anisotropy;
    }
    textureSet[0].colorSpace = SRGBColorSpace;
    textureSet[1].colorSpace = NoColorSpace;
    textureSet[2].colorSpace = NoColorSpace;
  }
  const cookingDeviceSets = [
    [saltfireIron, saltfireIronNormal, saltfireIronRoughness, 1.55, 1.45],
    [saltEtchedPolymer, saltEtchedPolymerNormal, saltEtchedPolymerRoughness, 1.25, 1.2],
  ] as const;
  for (const [albedo, normal, roughness, repeatX, repeatY] of cookingDeviceSets) {
    for (const texture of [albedo, normal, roughness]) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
      texture.anisotropy = anisotropy;
    }
    albedo.colorSpace = SRGBColorSpace;
    normal.colorSpace = NoColorSpace;
    roughness.colorSpace = NoColorSpace;
  }
  for (const texture of [fishEye, fishEyeNormal, fishEyeRoughness]) {
    texture.anisotropy = anisotropy;
  }
  fishEye.colorSpace = SRGBColorSpace;
  fishEyeNormal.colorSpace = NoColorSpace;
  fishEyeRoughness.colorSpace = NoColorSpace;

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

  for (const texture of [saltsealedGlove, saltsealedGloveNormal, saltsealedGloveRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(2.15, 2.15);
    texture.anisotropy = anisotropy;
  }
  saltsealedGlove.colorSpace = SRGBColorSpace;
  saltsealedGloveNormal.colorSpace = NoColorSpace;
  saltsealedGloveRoughness.colorSpace = NoColorSpace;

  for (const texture of [signalLaminate, signalLaminateNormal, signalLaminateRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.4, 1.2);
    texture.anisotropy = anisotropy;
  }
  signalLaminate.colorSpace = SRGBColorSpace;
  signalLaminateNormal.colorSpace = NoColorSpace;
  signalLaminateRoughness.colorSpace = NoColorSpace;

  for (const texture of [phosphorGlass, phosphorGlassNormal, phosphorGlassRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.05, 1.05);
    texture.anisotropy = anisotropy;
  }
  phosphorGlass.colorSpace = SRGBColorSpace;
  phosphorGlassNormal.colorSpace = NoColorSpace;
  phosphorGlassRoughness.colorSpace = NoColorSpace;

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
    silverSpineSkin,
    silverSpineSkinNormal,
    silverSpineSkinRoughness,
    amberFinSkin,
    amberFinSkinNormal,
    amberFinSkinRoughness,
    sailtailRunnerSkin,
    sailtailRunnerSkinNormal,
    sailtailRunnerSkinRoughness,
    fishFlesh,
    fishFleshNormal,
    fishFleshRoughness,
    cookedFishFlesh,
    cookedFishFleshNormal,
    cookedFishFleshRoughness,
    burntFishFlesh,
    burntFishFleshNormal,
    burntFishFleshRoughness,
    saltfireIron,
    saltfireIronNormal,
    saltfireIronRoughness,
    saltEtchedPolymer,
    saltEtchedPolymerNormal,
    saltEtchedPolymerRoughness,
    fishEye,
    fishEyeNormal,
    fishEyeRoughness,
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
    saltsealedGlove,
    saltsealedGloveNormal,
    saltsealedGloveRoughness,
    signalLaminate,
    signalLaminateNormal,
    signalLaminateRoughness,
    phosphorGlass,
    phosphorGlassNormal,
    phosphorGlassRoughness,
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
    silverSpineSkin: new MeshStandardMaterial({
      color: 0xf2f5eb,
      map: textures.silverSpineSkin,
      normalMap: textures.silverSpineSkinNormal,
      normalScale: new Vector2(0.42, 0.42),
      roughnessMap: textures.silverSpineSkinRoughness,
      roughness: 0.82,
      metalness: 0.02,
    }),
    amberFinSkin: new MeshStandardMaterial({
      color: 0xffe0b7,
      map: textures.amberFinSkin,
      normalMap: textures.amberFinSkinNormal,
      normalScale: new Vector2(0.45, 0.45),
      roughnessMap: textures.amberFinSkinRoughness,
      roughness: 0.84,
      metalness: 0.01,
    }),
    sailtailRunnerSkin: new MeshStandardMaterial({
      color: 0xc9e6de,
      map: textures.sailtailRunnerSkin,
      normalMap: textures.sailtailRunnerSkinNormal,
      normalScale: new Vector2(0.38, 0.38),
      roughnessMap: textures.sailtailRunnerSkinRoughness,
      roughness: 0.8,
      metalness: 0.02,
    }),
    fishFlesh: new MeshStandardMaterial({
      color: 0xffe1d1,
      map: textures.fishFlesh,
      normalMap: textures.fishFleshNormal,
      normalScale: new Vector2(0.34, 0.34),
      roughnessMap: textures.fishFleshRoughness,
      roughness: 0.82,
      metalness: 0,
    }),
    cookedFishFlesh: new MeshStandardMaterial({
      color: 0xffead7,
      map: textures.cookedFishFlesh,
      normalMap: textures.cookedFishFleshNormal,
      normalScale: new Vector2(0.36, 0.36),
      roughnessMap: textures.cookedFishFleshRoughness,
      roughness: 0.84,
      metalness: 0,
    }),
    burntFishFlesh: new MeshStandardMaterial({
      color: 0xffffff,
      map: textures.burntFishFlesh,
      normalMap: textures.burntFishFleshNormal,
      normalScale: new Vector2(0.42, 0.42),
      roughnessMap: textures.burntFishFleshRoughness,
      roughness: 0.94,
      metalness: 0,
    }),
    saltfireIron: new MeshStandardMaterial({
      color: 0xb9c1bd,
      map: textures.saltfireIron,
      normalMap: textures.saltfireIronNormal,
      normalScale: new Vector2(0.58, 0.58),
      roughnessMap: textures.saltfireIronRoughness,
      roughness: 0.78,
      metalness: 0.68,
    }),
    saltEtchedPolymer: new MeshStandardMaterial({
      color: 0xe2ebe4,
      map: textures.saltEtchedPolymer,
      normalMap: textures.saltEtchedPolymerNormal,
      normalScale: new Vector2(0.3, 0.3),
      roughnessMap: textures.saltEtchedPolymerRoughness,
      roughness: 0.72,
      metalness: 0,
    }),
    fishEye: new MeshStandardMaterial({
      color: 0xb7cfc4,
      map: textures.fishEye,
      normalMap: textures.fishEyeNormal,
      normalScale: new Vector2(0.14, 0.14),
      roughnessMap: textures.fishEyeRoughness,
      roughness: 0.46,
      metalness: 0,
      side: DoubleSide,
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
    saltsealedGlove: new MeshStandardMaterial({
      color: 0xffffff,
      map: textures.saltsealedGlove,
      normalMap: textures.saltsealedGloveNormal,
      normalScale: new Vector2(0.38, 0.38),
      roughnessMap: textures.saltsealedGloveRoughness,
      roughness: 0.9,
      metalness: 0,
      side: DoubleSide,
    }),
    signalLaminate: new MeshStandardMaterial({
      color: 0xd8e0d4,
      map: textures.signalLaminate,
      normalMap: textures.signalLaminateNormal,
      normalScale: new Vector2(0.64, 0.64),
      roughnessMap: textures.signalLaminateRoughness,
      roughness: 0.78,
      metalness: 0.18,
    }),
    phosphorGlass: new MeshStandardMaterial({
      color: 0xa7cbc2,
      map: textures.phosphorGlass,
      normalMap: textures.phosphorGlassNormal,
      normalScale: new Vector2(0.26, 0.26),
      roughnessMap: textures.phosphorGlassRoughness,
      roughness: 0.34,
      metalness: 0.08,
      emissive: 0x071b19,
      emissiveMap: textures.phosphorGlass,
      emissiveIntensity: 0.18,
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
