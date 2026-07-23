# M9 生物微材质整改验收

> 日期：2026-07-23
> 版本：`0.22.7`
> 状态：`APPROVED`（Image 2 来源、PBR、模型朝向、共享图集、代码原生 9 齿牙列、正式玩法预算与软件 framebuffer 闭环；目标真实 GPU 与最终可蒙皮 DCC 口腔/牙齿仍属发布门禁）

## 本轮范围

- 用专用深潮鲨口缘/鳃衬 PBR 取代 `sharkMouth` 的纯色表面；
- 用专用圆瞳侧眼 PBR 取代 `sharkEye` 的纯色表面，并修正眼片在正面扑咬时只剩一条边的问题；
- 将口缘从水平环修正为朝向玩家的真实正向轮廓；
- 将采集伤痕和鲨肉从口腔材质中拆出，透明复用已批准 TEX-019 鲜鱼肉来源的独立 atlas 副本；
- 以 Image 2 high 深潮鲨真皮齿 albedo 替换历史程序鲨皮，并将其派生 roughness 精确打包进 albedo alpha，维持两张运行纹理与既有预算；
- 用专用 Image 2 high 牙釉 PBR 取代鲨鱼牙齿错误复用的帆布材质；在真实口缘内加入一个固定 `InstancedMesh` 的 5 上排 + 4 下排牙列，并让两块鲨齿战利品板复用同材质；
- 不改变鲨鱼生命、AI 节奏、反击窗口、伤害、采集事务、战利品或 v18 存档。

## Image 2 来源

采用源均由项目 `scripts/imagegen` 读取本地 provider 配置，以固定参数生成：

```sh
scripts/imagegen generate --model gpt-image-2 --quality high --size 2048x2048 \
  --prompt-file tmp/imagegen/graywake-mouth-lining.txt --no-augment --force
scripts/imagegen generate --model gpt-image-2 --quality high --size 2048x2048 \
  --prompt-file tmp/imagegen/graywake-lateral-eye.txt --no-augment --force
```

鲨皮采用版由同一项目 CLI 的 `edit` 链路生成；最终 F 以 E 为编辑输入，仅调整色阶，固定 `gpt-image-2`、`high`、2048x2048 与 `--no-augment`。A 至 E 均未进入运行时：A 为过强压纹皮革，B 为织物/毡，C 为大块板岩，D 为环形鱼鳞流向，E 在真实水下过暗。F 保留细密低对比真皮齿密度和无焦点覆盖，只把炭灰抬升为可读的蓝绿灰。

归档文件：

- `artifacts/imagegen/graywake-mouth-lining-raw.png`，实际 2048x2048；
- `artifacts/imagegen/graywake-lateral-eye-raw.png`，实际 2048x2048；
- `artifacts/imagegen/graywake-lateral-eye-rejected-slit-raw.png`，实际 2048x2048，仅保存审计，不进入 PBR、图集或运行时。
- `artifacts/imagegen/graywake-shark-skin-raw.png`，实际 2048x2048；采用 F，运行时源图；
- `artifacts/imagegen/creature-pbr/graywake-shark-skin.webp`、`-normal.webp`、`-roughness.webp`，三张 1024 审计 PBR 图。
- `artifacts/imagegen/graywake-tooth-enamel-raw.png`，实际 2048x2048；候选 B 采用；
- `artifacts/imagegen/creature-pbr/graywake-tooth-enamel.webp`、`-normal.webp`、`-roughness.webp`，三张 1024 审计 PBR 图。

眼部首个候选出现明显猫科/爬行类纵向裂瞳，与提示中的圆瞳和海洋掠食者语义冲突，因此拒绝；第二个候选保持近黑圆瞳、烟琥珀/蓝灰虹膜和无烘焙 catchlight，采用。口腔采用版为蓝黑/克制梅红的连续活体衬层，没有牙齿、伤口、血液、完整动物或器物轮廓。

牙釉先以同一 `gpt-image-2 high` 2048 链路生成候选 A，再以项目 `scripts/imagegen edit --model gpt-image-2 --quality high --size 2048x2048 --no-augment` 修正为候选 B。A 的 2x2 审查出现宽水平明度带，未归档、未进入图集或运行时；B 保留低对比冷象牙、纵向釉纹、稀疏矿物孔和克制针状磨耗，移除了横向带状明度。完整最终提示词、处理参数与采用/拒绝原因见 TEX-052。

## 最终提示词

口缘与鳃衬：

```text
Use case: stylized-concept
Asset type: seamless tileable PBR base-color material for the mouth rim and gill lining of an original stylized ocean predator in a survival game.
Primary request: create an original deep-water shark mouth and gill lining surface: dense blue-black charcoal and restrained oxblood-plum membrane, with extremely fine pale gray-blue mucosal grain, subtle radial striation, sparse salt-water sheen variation, and no injury or gore. The surface should read as wet living tissue at close range while remaining quiet and believable from normal gameplay distance.
Scene/backdrop: material sheet only, edge-to-edge texture coverage.
Style/medium: premium stylized-realistic hand-authored game PBR albedo, tactile organic micro-detail with calm broad value variation.
Composition/framing: exact orthographic top-down square, uniform texel density, seamless wrapping on all four edges, no centered focal object, no mouth opening, no teeth, no gums in perspective, no animal silhouette.
Lighting/mood: flat neutral albedo only. Absolutely no baked directional light, highlight, reflections, cast shadow, ambient occlusion, depth cue, or photographic lens effect.
Color palette: deep charcoal navy, muted plum-maroon, faint cold gray-blue membrane striations; dark but with enough midtone separation to remain legible against gray shark skin.
Materials/textures: fine damp membrane grain, understated lengthwise and branching tissue detail, physically plausible rather than glossy plastic.
Constraints: fully original; clean seamless game material; no blood, wounds, teeth, tongue, eye, scales, fish, text, symbols, logo, watermark, border, frame, material ball, UV grid, or recognizable copyrighted design.
Avoid: flat single-color fill, bright red gore, pink cartoon flesh, repetitive checker pattern, large veins, pores, central vortex, perspective macro photograph, dramatic lighting, black crush, purple neon, and baked specular highlights.
```

深潮鲨侧眼：

```text
Use case: stylized-concept
Asset type: centered PBR albedo decal for the lateral eye of an original stylized ocean predator in a survival game.
Primary request: create one original shark eye seen exactly front-on as a clean circular iris-and-pupil decal: a compact near-black ROUND pupil with a softly irregular natural edge, restrained smoked amber and blue-gray radial iris fibers, a charcoal outer limbal ring, and a narrow pale sea-glass outer edge. It should feel alert and predatory but natural, readable at small in-game size, and compatible with a flat circular mesh.
Scene/backdrop: texture sheet only, pure matte black surrounding field outside the centered circular eye.
Style/medium: premium stylized-realistic hand-authored game PBR albedo, crisp controlled radial micro-detail without photo collage artifacts.
Composition/framing: exact orthographic square, the circular eye centered precisely in the image, evenly padded on all sides, no eyelids, skin, face, head, body, water, or perspective.
Lighting/mood: flat neutral albedo only. No catchlight, no white reflection, no baked directional light, no shadow, no ambient occlusion, no lens blur.
Color palette: graphite black pupil and ring, muted smoke-amber, mineral blue-gray, a subtle pale cool edge; avoid bright green, turquoise, yellow, or saturated orange.
Materials/textures: fine radial iris fibers and a soft wet organic depth cue that will be expressed by runtime normal and roughness maps rather than painted highlights.
Constraints: fully original; one centered anatomical-looking eye decal; no text, symbols, logo, watermark, frame, UV grid, decorative pattern, or recognizable copyrighted design.
Avoid: whole shark, multiple eyes, human eye anatomy, cat/reptile slit pupil, eyelashes, eyelids, glossy catchlight, fantasy glow, neon colors, photographic studio reflection, off-center pupil, cropped circle, or busy background.
```

## PBR 与图集

| 材质 | 处理 | 数值结果 | 结论 |
| --- | --- | --- | --- |
| 深潮鲨口缘/鳃衬 | `prepare_imagegen_material.py`：1024、seam 96、normal 0.52、roughness 72-162、boundary 优化 | x=`4.73/0.83x`，y=`8.32/0.96x`，boundary=`(38,546)` | 2x2 无硬缝；暗部仍有冷暖层次，无黑块、牙齿或血腥语义 |
| 深潮鲨侧眼 | `prepare_imagegen_eye.py`：1024、normal 0.28、roughness 58-138 | pupil=`5.1`、iris=`57.0`、edge=`0.1` | 圆瞳、虹膜纤维和冷色眼缘清楚；无裂瞳或烘焙高光 |
| 深潮鲨肉/伤痕 | TEX-019 已批准鲜鱼肉 PBR 的独立审计副本 | 1024 三图，不二次重采样 | 与口腔材质解耦；来源复用透明记录，不冒充新 Image 2 生成 |
| 深潮鲨主体皮肤 | `prepare_imagegen_material.py`：1024、seam 168、normal 0.18、roughness 160-216、boundary 优化；`pack_roughness_alpha.py` | x=`7.13/1.03x`，y=`13.00/0.98x`，boundary=`(1,1023)`；packed A 与 roughness 逐像素一致 | F 通过 2x2、水下近景和正式咬筏；不加入 4096 图集，保持 direct packed + normal 两图 |
| 深潮鲨牙釉 | `prepare_imagegen_material.py`：1024、seam 144、normal 0.22、roughness 116-176、boundary 优化 | x=`5.61/0.88x`，y=`4.77/1.00x`，boundary=`(1,1)` | B 通过 2x2；写入共享图集，不新增运行纹理；牙列只用一个实例批次 |

15 套独立审计 PBR 以 4x4 写入 `saltcrown-shared-pbr-atlas.webp` 和对应 normal atlas：4096x4096，每格 1024、核心 960、四周 32 像素周期 gutter。albedo RGB 与 roughness A 共图，normal 独立；保存后 alpha 逐像素一致。牙釉为 index 14 / column 2 / row 3，UV offset=`[0.5078125, 0.0078125]`、scale=`[0.234375, 0.234375]`；一格保留为空。packed/normal SHA-256 为 `f75058e82c690e94c9fd91fba5e0d10cde5ac34c612a53de28f72218287a29bd` / `f955650ede48ca16fc5602c803928fb654672f53e5e7de971693a661a4e4877b`。相比临时 3840/896 核心方案，正式版保持既有 960 核心，不以纹理预算为由降低历史材质分辨率。

鲨皮使用 1024 normal；`shark-skin-packed.webp` 保存采用 F 的 albedo RGB 和其派生 roughness A，shader 读取 alpha。`shark-skin.webp` 与 `shark-skin-roughness.webp` 只保留为历史审计对照，运行时只加载 packed + normal；这避免挤占已满的 4096 图集，也不增加正式咬筏的 `32/32` 预算。

## 模型与运行时

- 旧车削体鼻端由未封口尖端改为封闭钝吻前盘，增加 `shark-mouth-lining` 浅口腔面；口缘命名为 `shark-mouth-rim` 并置于真实前表面，不再埋在躯干内部；
- 双眼使用 24 段圆面、半径 0.09，并由严格侧向旋转为嵌入钝吻的侧前向；测试锁定局部法线朝前，正面扑咬不再只显示一条边或外凸圆盘；采集伤痕和鲨肉只使用 `sharkFlesh`；
- `shark-teeth` 使用一个六边锥体 `InstancedMesh`，固定 9 实例（5 上排、4 下排）和独立 `toothFocus` 诊断点；上排向下、下排向上排列于口缘内，所有实例与两块鲨齿战利品板都绑定 `sharkTooth` / `graywake-tooth-enamel`，不新增 draw call 或 runtime texture；
- 修正 Three.js 普通对象 `lookAt` 正 Z 与模型负 Z 鼻端相反的问题；巡游、追击、扑咬、退场和浮尸统一让鼻端朝目标，测试锁定水平目标点积 `>0.98`；
- 木筏与水中攻击中心停距分别从 2.5/2.65m 调整到 3.6/3.85m；1.85m 吻部在反击窗不再贴近裁剪面，冲击阶段仍完成咬合，七项 AI/伤害/采集测试保持通过；
- `facialFocus` 和真实双眼世界坐标进入诊断；浏览器门禁瞄准离相机最近的真实眼片，而不是虚构屏幕点；
- 鲨体割取把“有效按住意图”和“当前几何焦点”分开：浪面、镜头冲击或输入门禁的瞬时抖动只暂停进度，重新对准后续割；松开交互键、窗口失焦、战利品拒收或尸体下沉才清零。运行时同时公开 `inputEnabled / harvestHeld / harvestInputDown` 三态，避免门禁只能从停滞进度猜测；
- `sharkMaterialMaps` 必须同时报告 `[graywake-mouth-lining]`、`[graywake-shark-flesh]`、`[graywake-lateral-eye]`、`[graywake-tooth-enamel]`、共享双图集和采用 F 的 packed 鲨皮两图；`Materials.test.ts` 同时锁定鲨皮与牙釉 `map / normalMap / roughnessMap` 的三槽绑定和 alpha shader 标记；
- 专用门禁在真实活动帧首次进入反击窗的同一微任务读取当前 WebGL framebuffer，再触发正常失焦冻结；不二次 render、不改变相机，也不要求正式渲染器启用 `preserveDrawingBuffer`。

## 浏览器门禁

```sh
CAPTURE_ONLY=shark-facial-materials CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=shark-combat SHARK_COMBAT_STAGE=visual CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=shark-loot-water CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=underwater CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=building BUILDING_PART=damage CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=perimeter-defense-visual CAPTURE_FAST=1 npm run capture
```

专用材质场景走真实水中追击 AI；页面观察器只在真实 `windup + counterWindow=true` 的同一微任务原子读取玩家当前 framebuffer，然后才触发正常失焦冻结。renderer 计数、四类 atlas 区域、`teeth=9`、眼/牙焦点和 framebuffer 内容必须有效；水下场景因礁区与水体资源允许最多 36 张纹理。独立 `shark-combat visual` 仍走正式咬筏路径并把实际游戏预算锁定为 `<=32`。取证过程不移动相机、不二次 render，也不改变 AI、玩法状态或材质。

- 水中材质帧（采用 F 与 TEX-052）：`34 textures / 115 geometries / 43 calls / 96,354 triangles`，最近眼/牙点积 `0.965/0.982`；614x384 活动 framebuffer 为 `variation=253 / nonBlack=232,772`，已人工复核钝吻、嵌入式双眼、浅口腔、9 颗象牙釉牙列、采用 F 鲨皮、木矛、筏底与礁床同屏；
- 正式咬筏帧（采用 F 与 TEX-052）：`windup progress=0.226`、`0.743s` 到冲击、一次预兆/零结算，反击卡和准星均存在；四类 atlas 区域齐全，`32/32` 纹理，脸/眼/牙点积为 `0.950/0.982/0.941`；
- `shark-combat-windup` 分布采样为 `variation=231 / nonBlack=2,880`。本机 CDP 合成超时后的 DOM 兜底不作为美术图，水中活动 framebuffer 才是本轮视觉证据。
- 水中战利品逻辑档使用 320x200/低渲染负载，但仍运行正式固定步、AI、输入、存档和完整 4096 图集：一次真实刺击后连续完成四段按住割取，结算 `3 鲨肉 / 1 鲨皮 / 2 鲨齿`、矛耐久 `90 -> 89`、零世界掉包，结束时 `34 textures / 124 geometries / 51 calls / 66,666 triangles` 且 Context 健康；
- 4x4 图集跨系统回归：水下为 `29 / 118 / 256 / 140,650`、21 个 PBR 槽与 framebuffer 有效；周界为 `30 / 90 / 129 / 105,592`、导航合金/紧固件六槽与合成帧回退通过。结构材质帧为 `30 / 79 / 110 / 113,924` 且 Context/模拟健康；本机软件 WebGL 在第二次连续锤击的既有 8 秒输入时序等待超时，不能把该单次回归重跑写作三锤发布级通过。

本机曾把专用场景强制为原生 1024x640；软件 GLES 在 `34 textures / 116 geometries / 44 calls / 96,246 triangles` 时真实触发 Context Lost。水中割取的 1024x640 高负载复验也在 `34 / 121 / 49 / 97,634` 时由驱动丢失 Context。两次均按门禁拒绝，没有通过降低 4096 图集、删除 normal/roughness 或替换低质素材规避；视觉证据与逻辑证据因此分档，原生 1280x720/30 与 1920x1080/60 仍只在目标真实 GPU 验收。

## 外部门禁

- 目标真实 GPU 的 1280x720/30、1920x1080/60 双画质、夜间/风暴/水下眼口和采用 F 鲨皮的 mip/各向异性响应与 20 分钟长稳；
- 木矛和潮鸣震叉近景中的眼片、口缘、鳃衬、胸鳍遮挡、伤痕与鲨皮微结构；
- 鲨鱼预兆、扑空、反击、受击、浮尸和采集声音在真实音频设备上的混音；
- 最终 DCC 鲨体 UV、眼球体积、口腔/牙床/牙齿层、鳃盖变形、受击和浮尸动画；本轮通过的是代码原生 9 齿牙列，不替代可蒙皮 DCC 的口腔容积、牙龈、屏幕覆盖和变形验证；
- 采用 F 的源图授权、C2PA、商标和商业作品相似性复核。
