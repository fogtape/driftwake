import {
  AdditiveBlending,
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
  woodNormal: Texture;
  woodRoughness: Texture;
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
  tideboundRigging: Texture;
  tideboundRiggingNormal: Texture;
  tideboundRiggingRoughness: Texture;
  brinewornToolSteel: Texture;
  brinewornToolSteelNormal: Texture;
  brinewornToolSteelRoughness: Texture;
  islandStone: Texture;
  islandStoneNormal: Texture;
  islandStoneRoughness: Texture;
  palmBark: Texture;
  palmBarkNormal: Texture;
  palmBarkRoughness: Texture;
  palmFrond: Texture;
  palmFrondNormal: Texture;
  palmFrondRoughness: Texture;
  tidefruitSkin: Texture;
  tidefruitSkinNormal: Texture;
  tidefruitSkinRoughness: Texture;
  shoreGround: Texture;
  shoreGroundNormal: Texture;
  underwaterPbrAtlas: Texture;
  underwaterPbrNormalAtlas: Texture;
  reefSeabed: Texture;
  reefSeabedNormal: Texture;
  reefSeabedRoughness: Texture;
  sailCloth: Texture;
  sailClothNormal: Texture;
  sailClothRoughness: Texture;
  planterSoil: Texture;
  planterSoilNormal: Texture;
  planterSoilRoughness: Texture;
  cropLeaf: Texture;
  cropLeafNormal: Texture;
  cropLeafRoughness: Texture;
  cropDry: Texture;
  cropDryNormal: Texture;
  cropDryRoughness: Texture;
  cropFruit: Texture;
  cropFruitNormal: Texture;
  cropFruitRoughness: Texture;
  birdFeather: Texture;
  birdFeatherNormal: Texture;
  birdFeatherRoughness: Texture;
  birdWing: Texture;
  birdWingNormal: Texture;
  birdWingRoughness: Texture;
  birdBeak: Texture;
  birdBeakNormal: Texture;
  birdBeakRoughness: Texture;
  birdEye: Texture;
  birdEyeNormal: Texture;
  birdEyeRoughness: Texture;
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
  choirBronze: Texture;
  choirBronzeNormal: Texture;
  choirBronzeRoughness: Texture;
  stormCeramic: Texture;
  stormCeramicNormal: Texture;
  stormCeramicRoughness: Texture;
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
  palmBark: MeshStandardMaterial;
  tidefruitSkin: MeshStandardMaterial;
  shoreGround: MeshStandardMaterial;
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
  choirBronze: MeshStandardMaterial;
  stormCeramic: MeshStandardMaterial;
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
    woodNormal,
    woodRoughness,
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
    tideboundRigging,
    tideboundRiggingNormal,
    tideboundRiggingRoughness,
    brinewornToolSteel,
    brinewornToolSteelNormal,
    brinewornToolSteelRoughness,
    islandStone,
    islandStoneNormal,
    islandStoneRoughness,
    palmBark,
    palmBarkNormal,
    palmBarkRoughness,
    palmFrond,
    palmFrondNormal,
    palmFrondRoughness,
    tidefruitSkin,
    tidefruitSkinNormal,
    tidefruitSkinRoughness,
    shoreGround,
    shoreGroundNormal,
    underwaterPbrAtlas,
    underwaterPbrNormalAtlas,
    reefSeabed,
    reefSeabedNormal,
    reefSeabedRoughness,
    sailCloth,
    sailClothNormal,
    sailClothRoughness,
    planterSoil,
    planterSoilNormal,
    planterSoilRoughness,
    cropLeaf,
    cropLeafNormal,
    cropLeafRoughness,
    cropDry,
    cropDryNormal,
    cropDryRoughness,
    cropFruit,
    cropFruitNormal,
    cropFruitRoughness,
    birdFeather,
    birdFeatherNormal,
    birdFeatherRoughness,
    birdWing,
    birdWingNormal,
    birdWingRoughness,
    birdBeak,
    birdBeakNormal,
    birdBeakRoughness,
    birdEye,
    birdEyeNormal,
    birdEyeRoughness,
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
    choirBronze,
    choirBronzeNormal,
    choirBronzeRoughness,
    stormCeramic,
    stormCeramicNormal,
    stormCeramicRoughness,
    stormClouds,
  ] = await Promise.all([
    loader.loadAsync('/assets/textures/weathered-cedar.webp'),
    loader.loadAsync('/assets/textures/weathered-cedar-normal.webp'),
    loader.loadAsync('/assets/textures/weathered-cedar-roughness.webp'),
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
    loader.loadAsync('/assets/textures/tidebound-rigging.webp'),
    loader.loadAsync('/assets/textures/tidebound-rigging-normal.webp'),
    loader.loadAsync('/assets/textures/tidebound-rigging-roughness.webp'),
    loader.loadAsync('/assets/textures/brineworn-tool-steel.webp'),
    loader.loadAsync('/assets/textures/brineworn-tool-steel-normal.webp'),
    loader.loadAsync('/assets/textures/brineworn-tool-steel-roughness.webp'),
    loader.loadAsync('/assets/textures/stormwashed-island-stone.webp'),
    loader.loadAsync('/assets/textures/stormwashed-island-stone-normal.webp'),
    loader.loadAsync('/assets/textures/stormwashed-island-stone-roughness.webp'),
    loader.loadAsync('/assets/textures/saltcrown-palm-bark.webp'),
    loader.loadAsync('/assets/textures/saltcrown-palm-bark-normal.webp'),
    loader.loadAsync('/assets/textures/saltcrown-palm-bark-roughness.webp'),
    loader.loadAsync('/assets/textures/saltcrown-palm-frond.webp'),
    loader.loadAsync('/assets/textures/saltcrown-palm-frond-normal.webp'),
    loader.loadAsync('/assets/textures/saltcrown-palm-frond-roughness.webp'),
    loader.loadAsync('/assets/textures/tidefruit-skin.webp'),
    loader.loadAsync('/assets/textures/tidefruit-skin-normal.webp'),
    loader.loadAsync('/assets/textures/tidefruit-skin-roughness.webp'),
    loader.loadAsync('/assets/textures/saltcrown-shore-ground-packed.webp'),
    loader.loadAsync('/assets/textures/saltcrown-shore-ground-normal.webp'),
    loader.loadAsync('/assets/textures/saltcrown-underwater-pbr-atlas.webp'),
    loader.loadAsync('/assets/textures/saltcrown-underwater-pbr-normal-atlas.webp'),
    loader.loadAsync('/assets/textures/reef-seabed.webp'),
    loader.loadAsync('/assets/textures/reef-seabed-normal.webp'),
    loader.loadAsync('/assets/textures/reef-seabed-roughness.webp'),
    loader.loadAsync('/assets/textures/sail-cloth.webp'),
    loader.loadAsync('/assets/textures/sail-cloth-normal.webp'),
    loader.loadAsync('/assets/textures/sail-cloth-roughness.webp'),
    loader.loadAsync('/assets/textures/planter-soil.webp'),
    loader.loadAsync('/assets/textures/planter-soil-normal.webp'),
    loader.loadAsync('/assets/textures/planter-soil-roughness.webp'),
    loader.loadAsync('/assets/textures/salt-crown-leaf.webp'),
    loader.loadAsync('/assets/textures/salt-crown-leaf-normal.webp'),
    loader.loadAsync('/assets/textures/salt-crown-leaf-roughness.webp'),
    loader.loadAsync('/assets/textures/salt-crown-dry-leaf.webp'),
    loader.loadAsync('/assets/textures/salt-crown-dry-leaf-normal.webp'),
    loader.loadAsync('/assets/textures/salt-crown-dry-leaf-roughness.webp'),
    loader.loadAsync('/assets/textures/salt-crown-fruit.webp'),
    loader.loadAsync('/assets/textures/salt-crown-fruit-normal.webp'),
    loader.loadAsync('/assets/textures/salt-crown-fruit-roughness.webp'),
    loader.loadAsync('/assets/textures/saltwing-body-feather.webp'),
    loader.loadAsync('/assets/textures/saltwing-body-feather-normal.webp'),
    loader.loadAsync('/assets/textures/saltwing-body-feather-roughness.webp'),
    loader.loadAsync('/assets/textures/saltwing-flight-feather.webp'),
    loader.loadAsync('/assets/textures/saltwing-flight-feather-normal.webp'),
    loader.loadAsync('/assets/textures/saltwing-flight-feather-roughness.webp'),
    loader.loadAsync('/assets/textures/saltwing-keratin.webp'),
    loader.loadAsync('/assets/textures/saltwing-keratin-normal.webp'),
    loader.loadAsync('/assets/textures/saltwing-keratin-roughness.webp'),
    loader.loadAsync('/assets/textures/saltwing-eye.webp'),
    loader.loadAsync('/assets/textures/saltwing-eye-normal.webp'),
    loader.loadAsync('/assets/textures/saltwing-eye-roughness.webp'),
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
    loader.loadAsync('/assets/textures/iron-choir-resonant-bronze.webp'),
    loader.loadAsync('/assets/textures/iron-choir-resonant-bronze-normal.webp'),
    loader.loadAsync('/assets/textures/iron-choir-resonant-bronze-roughness.webp'),
    loader.loadAsync('/assets/textures/storm-needle-electret-ceramic.webp'),
    loader.loadAsync('/assets/textures/storm-needle-electret-ceramic-normal.webp'),
    loader.loadAsync('/assets/textures/storm-needle-electret-ceramic-roughness.webp'),
    loader.loadAsync('/assets/textures/storm-clouds.webp'),
  ]);

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textureNames: Array<[Texture, string]> = [
    [wood, 'weathered-cedar-albedo'],
    [woodNormal, 'weathered-cedar-normal'],
    [woodRoughness, 'weathered-cedar-roughness'],
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
    [tideboundRigging, 'tidebound-rigging-albedo'],
    [tideboundRiggingNormal, 'tidebound-rigging-normal'],
    [tideboundRiggingRoughness, 'tidebound-rigging-roughness'],
    [brinewornToolSteel, 'brineworn-tool-steel-albedo'],
    [brinewornToolSteelNormal, 'brineworn-tool-steel-normal'],
    [brinewornToolSteelRoughness, 'brineworn-tool-steel-roughness'],
    [islandStone, 'stormwashed-island-stone-albedo'],
    [islandStoneNormal, 'stormwashed-island-stone-normal'],
    [islandStoneRoughness, 'stormwashed-island-stone-roughness'],
    [palmBark, 'saltcrown-palm-bark-albedo'],
    [palmBarkNormal, 'saltcrown-palm-bark-normal'],
    [palmBarkRoughness, 'saltcrown-palm-bark-roughness'],
    [palmFrond, 'saltcrown-palm-frond-albedo'],
    [palmFrondNormal, 'saltcrown-palm-frond-normal'],
    [palmFrondRoughness, 'saltcrown-palm-frond-roughness'],
    [tidefruitSkin, 'tidefruit-skin-albedo'],
    [tidefruitSkinNormal, 'tidefruit-skin-normal'],
    [tidefruitSkinRoughness, 'tidefruit-skin-roughness'],
    [shoreGround, 'saltcrown-shore-ground-packed'],
    [shoreGroundNormal, 'saltcrown-shore-ground-normal'],
    [underwaterPbrAtlas, 'saltcrown-underwater-pbr-atlas'],
    [underwaterPbrNormalAtlas, 'saltcrown-underwater-pbr-normal-atlas'],
    [cropLeaf, 'salt-crown-leaf-albedo'],
    [cropLeafNormal, 'salt-crown-leaf-normal'],
    [cropLeafRoughness, 'salt-crown-leaf-roughness'],
    [cropDry, 'salt-crown-dry-leaf-albedo'],
    [cropDryNormal, 'salt-crown-dry-leaf-normal'],
    [cropDryRoughness, 'salt-crown-dry-leaf-roughness'],
    [cropFruit, 'salt-crown-fruit-albedo'],
    [cropFruitNormal, 'salt-crown-fruit-normal'],
    [cropFruitRoughness, 'salt-crown-fruit-roughness'],
    [birdFeather, 'saltwing-body-feather-albedo'],
    [birdFeatherNormal, 'saltwing-body-feather-normal'],
    [birdFeatherRoughness, 'saltwing-body-feather-roughness'],
    [birdWing, 'saltwing-flight-feather-albedo'],
    [birdWingNormal, 'saltwing-flight-feather-normal'],
    [birdWingRoughness, 'saltwing-flight-feather-roughness'],
    [birdBeak, 'saltwing-keratin-albedo'],
    [birdBeakNormal, 'saltwing-keratin-normal'],
    [birdBeakRoughness, 'saltwing-keratin-roughness'],
    [birdEye, 'saltwing-eye-albedo'],
    [birdEyeNormal, 'saltwing-eye-normal'],
    [birdEyeRoughness, 'saltwing-eye-roughness'],
    [choirBronze, 'iron-choir-resonant-bronze-albedo'],
    [choirBronzeNormal, 'iron-choir-resonant-bronze-normal'],
    [choirBronzeRoughness, 'iron-choir-resonant-bronze-roughness'],
    [stormCeramic, 'storm-needle-electret-ceramic-albedo'],
    [stormCeramicNormal, 'storm-needle-electret-ceramic-normal'],
    [stormCeramicRoughness, 'storm-needle-electret-ceramic-roughness'],
  ];
  textureNames.forEach(([texture, name]) => {
    texture.name = name;
  });
  for (const texture of [wood, woodNormal, woodRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.35, 0.72);
    texture.anisotropy = anisotropy;
  }
  wood.colorSpace = SRGBColorSpace;
  woodNormal.colorSpace = NoColorSpace;
  woodRoughness.colorSpace = NoColorSpace;

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

  for (const texture of [tideboundRigging, tideboundRiggingNormal, tideboundRiggingRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.4, 1.4);
    texture.anisotropy = anisotropy;
  }
  tideboundRigging.colorSpace = SRGBColorSpace;
  tideboundRiggingNormal.colorSpace = NoColorSpace;
  tideboundRiggingRoughness.colorSpace = NoColorSpace;

  for (const texture of [brinewornToolSteel, brinewornToolSteelNormal, brinewornToolSteelRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.55, 1.45);
    texture.anisotropy = anisotropy;
  }
  brinewornToolSteel.colorSpace = SRGBColorSpace;
  brinewornToolSteelNormal.colorSpace = NoColorSpace;
  brinewornToolSteelRoughness.colorSpace = NoColorSpace;

  const islandMaterialSets = [
    [islandStone, islandStoneNormal, islandStoneRoughness, 1.65, 1.55],
    [palmBark, palmBarkNormal, palmBarkRoughness, 1.05, 1.05],
    [palmFrond, palmFrondNormal, palmFrondRoughness, 1.12, 1.12],
    [tidefruitSkin, tidefruitSkinNormal, tidefruitSkinRoughness, 1.15, 1.15],
  ] as const;
  for (const [albedo, normal, roughness, repeatX, repeatY] of islandMaterialSets) {
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
  for (const texture of [shoreGround, shoreGroundNormal]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(4.4, 3.8);
    texture.anisotropy = anisotropy;
  }
  shoreGround.colorSpace = SRGBColorSpace;
  shoreGroundNormal.colorSpace = NoColorSpace;

  underwaterPbrAtlas.colorSpace = SRGBColorSpace;
  underwaterPbrNormalAtlas.colorSpace = NoColorSpace;
  underwaterPbrAtlas.anisotropy = anisotropy;
  underwaterPbrNormalAtlas.anisotropy = anisotropy;

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

  const plantingMaterialSets = [
    [cropLeaf, cropLeafNormal, cropLeafRoughness, 1, 1],
    [cropDry, cropDryNormal, cropDryRoughness, 1, 1],
    [cropFruit, cropFruitNormal, cropFruitRoughness, 1.1, 1.1],
    [birdFeather, birdFeatherNormal, birdFeatherRoughness, 1, 1],
    [birdWing, birdWingNormal, birdWingRoughness, 0.72, 0.72],
    [birdBeak, birdBeakNormal, birdBeakRoughness, 1.35, 1.35],
  ] as const;
  for (const [albedo, normal, roughness, repeatX, repeatY] of plantingMaterialSets) {
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
  for (const texture of [birdEye, birdEyeNormal, birdEyeRoughness]) texture.anisotropy = anisotropy;
  birdEye.colorSpace = SRGBColorSpace;
  birdEyeNormal.colorSpace = NoColorSpace;
  birdEyeRoughness.colorSpace = NoColorSpace;

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

  for (const texture of [choirBronze, choirBronzeNormal, choirBronzeRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.35, 1.35);
    texture.anisotropy = anisotropy;
  }
  choirBronze.colorSpace = SRGBColorSpace;
  choirBronzeNormal.colorSpace = NoColorSpace;
  choirBronzeRoughness.colorSpace = NoColorSpace;

  for (const texture of [stormCeramic, stormCeramicNormal, stormCeramicRoughness]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1.7, 1.5);
    texture.anisotropy = anisotropy;
  }
  stormCeramic.colorSpace = SRGBColorSpace;
  stormCeramicNormal.colorSpace = NoColorSpace;
  stormCeramicRoughness.colorSpace = NoColorSpace;

  stormClouds.colorSpace = SRGBColorSpace;
  stormClouds.wrapS = RepeatWrapping;
  stormClouds.wrapT = RepeatWrapping;
  stormClouds.repeat.set(2, 1);
  stormClouds.anisotropy = anisotropy;

  return {
    wood,
    woodNormal,
    woodRoughness,
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
    tideboundRigging,
    tideboundRiggingNormal,
    tideboundRiggingRoughness,
    brinewornToolSteel,
    brinewornToolSteelNormal,
    brinewornToolSteelRoughness,
    islandStone,
    islandStoneNormal,
    islandStoneRoughness,
    palmBark,
    palmBarkNormal,
    palmBarkRoughness,
    palmFrond,
    palmFrondNormal,
    palmFrondRoughness,
    tidefruitSkin,
    tidefruitSkinNormal,
    tidefruitSkinRoughness,
    shoreGround,
    shoreGroundNormal,
    underwaterPbrAtlas,
    underwaterPbrNormalAtlas,
    reefSeabed,
    reefSeabedNormal,
    reefSeabedRoughness,
    sailCloth,
    sailClothNormal,
    sailClothRoughness,
    planterSoil,
    planterSoilNormal,
    planterSoilRoughness,
    cropLeaf,
    cropLeafNormal,
    cropLeafRoughness,
    cropDry,
    cropDryNormal,
    cropDryRoughness,
    cropFruit,
    cropFruitNormal,
    cropFruitRoughness,
    birdFeather,
    birdFeatherNormal,
    birdFeatherRoughness,
    birdWing,
    birdWingNormal,
    birdWingRoughness,
    birdBeak,
    birdBeakNormal,
    birdBeakRoughness,
    birdEye,
    birdEyeNormal,
    birdEyeRoughness,
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
    choirBronze,
    choirBronzeNormal,
    choirBronzeRoughness,
    stormCeramic,
    stormCeramicNormal,
    stormCeramicRoughness,
    stormClouds,
  };
}

function woodVariant(
  source: Texture,
  normalSource: Texture,
  roughnessSource: Texture,
  color: number,
  offsetX: number,
): MeshStandardMaterial {
  const [map, normalMap, roughnessMap] = [source, normalSource, roughnessSource].map((texture) => {
    const copy = texture.clone();
    copy.offset.x = offsetX;
    copy.needsUpdate = true;
    return copy;
  });
  return new MeshStandardMaterial({
    color,
    map,
    normalMap,
    normalScale: new Vector2(0.38, 0.38),
    roughnessMap,
    roughness: 0.88,
    metalness: 0.0,
  });
}

const ALPHA_PACKED_ROUGHNESS_CACHE_KEY = 'driftwake-alpha-packed-roughness-v1';

interface PbrAtlasRegion {
  name: string;
  offset: readonly [number, number];
  scale: readonly [number, number];
  repeat: readonly [number, number];
}

const UNDERWATER_ATLAS_REGIONS = {
  reefRock: {
    name: 'brine-reef-rock',
    offset: [0.0078125, 0.515625],
    scale: [0.234375, 0.46875],
    repeat: [1.35, 1.35],
  },
  coralWarm: {
    name: 'ember-branch-coral',
    offset: [0.2578125, 0.515625],
    scale: [0.234375, 0.46875],
    repeat: [1, 1.35],
  },
  coralPale: {
    name: 'tidecrown-pale-coral',
    offset: [0.5078125, 0.515625],
    scale: [0.234375, 0.46875],
    repeat: [1, 1.35],
  },
  seaweed: {
    name: 'long-ribbon-seaweed',
    offset: [0.7578125, 0.515625],
    scale: [0.234375, 0.46875],
    repeat: [0.75, 1.15],
  },
  ore: {
    name: 'saltcrust-metal-ore',
    offset: [0.0078125, 0.015625],
    scale: [0.234375, 0.46875],
    repeat: [1.25, 1.25],
  },
  clay: {
    name: 'tide-red-reef-clay',
    offset: [0.2578125, 0.015625],
    scale: [0.234375, 0.46875],
    repeat: [1.15, 1.15],
  },
  reefFish: {
    name: 'saltcrown-reef-fish-skin',
    offset: [0.5078125, 0.015625],
    scale: [0.234375, 0.46875],
    repeat: [1.35, 1],
  },
} as const satisfies Record<string, PbrAtlasRegion>;

function useAlphaPackedRoughness(material: MeshStandardMaterial): MeshStandardMaterial {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'roughnessFactor *= texelRoughness.g;',
      'roughnessFactor *= texelRoughness.a;',
    );
  };
  material.customProgramCacheKey = () => ALPHA_PACKED_ROUGHNESS_CACHE_KEY;
  material.userData.alphaPackedRoughness = true;
  return material;
}

function usePackedPbrAtlas(material: MeshStandardMaterial, region: PbrAtlasRegion): MeshStandardMaterial {
  const [offsetX, offsetY] = region.offset.map((value) => value.toFixed(7));
  const [scaleX, scaleY] = region.scale.map((value) => value.toFixed(7));
  const [repeatX, repeatY] = region.repeat.map((value) => value.toFixed(7));
  const transformUv = (varying: string, define: string) => `
#ifdef ${define}
  ${varying} = fract(${varying} * vec2(${repeatX}, ${repeatY}))
    * vec2(${scaleX}, ${scaleY}) + vec2(${offsetX}, ${offsetY});
#endif`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>${transformUv('vMapUv', 'USE_MAP')}${transformUv('vNormalMapUv', 'USE_NORMALMAP')}${transformUv('vRoughnessMapUv', 'USE_ROUGHNESSMAP')}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'roughnessFactor *= texelRoughness.g;',
      'roughnessFactor *= texelRoughness.a;',
    );
  };
  material.customProgramCacheKey = () => `driftwake-underwater-pbr-atlas-v1:${region.name}:${repeatX}:${repeatY}`;
  material.userData.pbrAtlasRegion = region.name;
  material.userData.pbrAtlasOffset = [...region.offset];
  material.userData.pbrAtlasScale = [...region.scale];
  material.userData.pbrAtlasRepeat = [...region.repeat];
  material.userData.alphaPackedRoughness = true;
  return material;
}

export function cloneAlphaPackedRoughnessMaterial(source: MeshStandardMaterial): MeshStandardMaterial {
  return useAlphaPackedRoughness(source.clone());
}

export function createMaterialLibrary(textures: AssetTextures): MaterialLibrary {
  const causticMap = textures.foam.clone();
  causticMap.repeat.set(9.5, 9.5);
  causticMap.rotation = 0.34;
  causticMap.needsUpdate = true;
  return {
    wood: [
      woodVariant(textures.wood, textures.woodNormal, textures.woodRoughness, 0xffffff, 0.0),
      woodVariant(textures.wood, textures.woodNormal, textures.woodRoughness, 0xe7d2ae, 0.29),
      woodVariant(textures.wood, textures.woodNormal, textures.woodRoughness, 0xc8d1c6, 0.61),
    ],
    darkWood: woodVariant(textures.wood, textures.woodNormal, textures.woodRoughness, 0x9a7659, 0.77),
    rope: new MeshStandardMaterial({
      color: 0xffefd1,
      map: textures.tideboundRigging,
      normalMap: textures.tideboundRiggingNormal,
      normalScale: new Vector2(0.52, 0.52),
      roughnessMap: textures.tideboundRiggingRoughness,
      roughness: 0.98,
    }),
    metal: new MeshStandardMaterial({
      color: 0xf0f5f0,
      map: textures.brinewornToolSteel,
      normalMap: textures.brinewornToolSteelNormal,
      normalScale: new Vector2(0.5, 0.5),
      roughnessMap: textures.brinewornToolSteelRoughness,
      roughness: 0.48,
      metalness: 0.72,
    }),
    rustMetal: new MeshStandardMaterial({
      color: 0xefc2ae,
      map: textures.brinewornToolSteel,
      normalMap: textures.brinewornToolSteelNormal,
      normalScale: new Vector2(0.58, 0.58),
      roughnessMap: textures.brinewornToolSteelRoughness,
      roughness: 0.62,
      metalness: 0.54,
    }),
    polymer: new MeshStandardMaterial({
      color: 0x8dbdc1,
      map: textures.saltEtchedPolymer,
      normalMap: textures.saltEtchedPolymerNormal,
      normalScale: new Vector2(0.32, 0.32),
      roughnessMap: textures.saltEtchedPolymerRoughness,
      roughness: 0.68,
      metalness: 0.0,
    }),
    leaf: new MeshStandardMaterial({
      color: 0xb9cba3,
      map: textures.palmFrond,
      normalMap: textures.palmFrondNormal,
      normalScale: new Vector2(0.42, 0.42),
      roughnessMap: textures.palmFrondRoughness,
      roughness: 0.88,
      side: DoubleSide,
    }),
    rock: new MeshStandardMaterial({
      color: 0xc4c0b3,
      map: textures.islandStone,
      normalMap: textures.islandStoneNormal,
      normalScale: new Vector2(0.58, 0.58),
      roughnessMap: textures.islandStoneRoughness,
      roughness: 0.96,
      flatShading: true,
    }),
    foliage: new MeshStandardMaterial({
      color: 0x9fbb8f,
      map: textures.palmFrond,
      normalMap: textures.palmFrondNormal,
      normalScale: new Vector2(0.38, 0.38),
      roughnessMap: textures.palmFrondRoughness,
      roughness: 0.9,
      flatShading: true,
      side: DoubleSide,
    }),
    palmBark: new MeshStandardMaterial({
      color: 0xd5c1a5,
      map: textures.palmBark,
      normalMap: textures.palmBarkNormal,
      normalScale: new Vector2(0.62, 0.62),
      roughnessMap: textures.palmBarkRoughness,
      roughness: 0.97,
    }),
    tidefruitSkin: new MeshStandardMaterial({
      color: 0xd9b497,
      map: textures.tidefruitSkin,
      normalMap: textures.tidefruitSkinNormal,
      normalScale: new Vector2(0.34, 0.34),
      roughnessMap: textures.tidefruitSkinRoughness,
      roughness: 0.68,
    }),
    shoreGround: useAlphaPackedRoughness(new MeshStandardMaterial({
      color: 0xffffff,
      map: textures.shoreGround,
      normalMap: textures.shoreGroundNormal,
      normalScale: new Vector2(0.42, 0.42),
      roughnessMap: textures.shoreGround,
      roughness: 0.98,
    })),
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
    reefRock: usePackedPbrAtlas(new MeshStandardMaterial({
      color: 0xc4d0ca,
      map: textures.underwaterPbrAtlas,
      normalMap: textures.underwaterPbrNormalAtlas,
      normalScale: new Vector2(0.55, 0.55),
      roughnessMap: textures.underwaterPbrAtlas,
      roughness: 0.94,
      flatShading: true,
    }), UNDERWATER_ATLAS_REGIONS.reefRock),
    coralWarm: usePackedPbrAtlas(new MeshStandardMaterial({
      color: 0xf6c8bd,
      map: textures.underwaterPbrAtlas,
      normalMap: textures.underwaterPbrNormalAtlas,
      normalScale: new Vector2(0.42, 0.42),
      roughnessMap: textures.underwaterPbrAtlas,
      roughness: 0.84,
      flatShading: true,
    }), UNDERWATER_ATLAS_REGIONS.coralWarm),
    coralPale: usePackedPbrAtlas(new MeshStandardMaterial({
      color: 0xf4f0d9,
      map: textures.underwaterPbrAtlas,
      normalMap: textures.underwaterPbrNormalAtlas,
      normalScale: new Vector2(0.44, 0.44),
      roughnessMap: textures.underwaterPbrAtlas,
      roughness: 0.9,
      flatShading: true,
    }), UNDERWATER_ATLAS_REGIONS.coralPale),
    seaweed: usePackedPbrAtlas(new MeshStandardMaterial({
      color: 0xd2e1d2,
      map: textures.underwaterPbrAtlas,
      normalMap: textures.underwaterPbrNormalAtlas,
      normalScale: new Vector2(0.38, 0.38),
      roughnessMap: textures.underwaterPbrAtlas,
      roughness: 0.82,
      side: DoubleSide,
    }), UNDERWATER_ATLAS_REGIONS.seaweed),
    ore: usePackedPbrAtlas(new MeshStandardMaterial({
      color: 0xd4e7e4,
      map: textures.underwaterPbrAtlas,
      normalMap: textures.underwaterPbrNormalAtlas,
      normalScale: new Vector2(0.58, 0.58),
      roughnessMap: textures.underwaterPbrAtlas,
      roughness: 0.58,
      metalness: 0.54,
      flatShading: true,
    }), UNDERWATER_ATLAS_REGIONS.ore),
    clay: usePackedPbrAtlas(new MeshStandardMaterial({
      color: 0xe0b2a8,
      map: textures.underwaterPbrAtlas,
      normalMap: textures.underwaterPbrNormalAtlas,
      normalScale: new Vector2(0.44, 0.44),
      roughnessMap: textures.underwaterPbrAtlas,
      roughness: 0.98,
      flatShading: true,
    }), UNDERWATER_ATLAS_REGIONS.clay),
    reefFish: usePackedPbrAtlas(new MeshStandardMaterial({
      color: 0xdcebea,
      map: textures.underwaterPbrAtlas,
      normalMap: textures.underwaterPbrNormalAtlas,
      normalScale: new Vector2(0.28, 0.28),
      roughnessMap: textures.underwaterPbrAtlas,
      roughness: 0.68,
      metalness: 0.02,
      flatShading: true,
    }), UNDERWATER_ATLAS_REGIONS.reefFish),
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
    choirBronze: new MeshStandardMaterial({
      color: 0xf1ead9,
      map: textures.choirBronze,
      normalMap: textures.choirBronzeNormal,
      normalScale: new Vector2(0.46, 0.46),
      roughnessMap: textures.choirBronzeRoughness,
      roughness: 0.74,
      metalness: 0.56,
    }),
    stormCeramic: new MeshStandardMaterial({
      color: 0xdce0d5,
      map: textures.stormCeramic,
      normalMap: textures.stormCeramicNormal,
      normalScale: new Vector2(0.42, 0.42),
      roughnessMap: textures.stormCeramicRoughness,
      roughness: 0.86,
      metalness: 0.04,
    }),
    cropLeaf: new MeshStandardMaterial({
      color: 0xd6e2ce,
      map: textures.cropLeaf,
      normalMap: textures.cropLeafNormal,
      normalScale: new Vector2(0.34, 0.34),
      roughnessMap: textures.cropLeafRoughness,
      roughness: 0.8,
      metalness: 0,
      side: DoubleSide,
      emissive: 0x315431,
      emissiveMap: textures.cropLeaf,
      emissiveIntensity: 0.48,
    }),
    cropDry: new MeshStandardMaterial({
      color: 0xe0caa2,
      map: textures.cropDry,
      normalMap: textures.cropDryNormal,
      normalScale: new Vector2(0.42, 0.42),
      roughnessMap: textures.cropDryRoughness,
      roughness: 0.98,
      metalness: 0,
      side: DoubleSide,
      emissive: 0x5c431c,
      emissiveMap: textures.cropDry,
      emissiveIntensity: 0.34,
    }),
    cropFruit: new MeshStandardMaterial({
      color: 0xe5dda9,
      map: textures.cropFruit,
      normalMap: textures.cropFruitNormal,
      normalScale: new Vector2(0.3, 0.3),
      roughnessMap: textures.cropFruitRoughness,
      roughness: 0.68,
      metalness: 0,
      flatShading: true,
    }),
    birdFeather: new MeshStandardMaterial({
      color: 0xd1dad4,
      map: textures.birdFeather,
      normalMap: textures.birdFeatherNormal,
      normalScale: new Vector2(0.3, 0.3),
      roughnessMap: textures.birdFeatherRoughness,
      roughness: 0.9,
      metalness: 0,
      flatShading: true,
      emissive: 0x303c38,
      emissiveMap: textures.birdFeather,
      emissiveIntensity: 0.25,
    }),
    birdWing: new MeshStandardMaterial({
      color: 0xb8ccc6,
      map: textures.birdWing,
      normalMap: textures.birdWingNormal,
      normalScale: new Vector2(0.36, 0.36),
      roughnessMap: textures.birdWingRoughness,
      roughness: 0.92,
      metalness: 0,
      side: DoubleSide,
      flatShading: true,
      emissive: 0x183d39,
      emissiveMap: textures.birdWing,
      emissiveIntensity: 0.38,
    }),
    birdBeak: new MeshStandardMaterial({
      color: 0xe7d3ad,
      map: textures.birdBeak,
      normalMap: textures.birdBeakNormal,
      normalScale: new Vector2(0.24, 0.24),
      roughnessMap: textures.birdBeakRoughness,
      roughness: 0.74,
      metalness: 0,
      flatShading: true,
    }),
    birdEye: new MeshStandardMaterial({
      color: 0xffffff,
      map: textures.birdEye,
      normalMap: textures.birdEyeNormal,
      normalScale: new Vector2(0.1, 0.1),
      roughnessMap: textures.birdEyeRoughness,
      roughness: 0.42,
      metalness: 0,
      side: DoubleSide,
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
