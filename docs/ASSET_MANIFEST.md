# 原创资产清单

> 更新日期：2026-07-22
> 状态：第二十轮 M9 水下礁区与资源历史材质整改已通过来源、PBR、平铺、双图集预算与软件场景门禁，发布前仍需做最终授权、DCC 替换与相似性复核

## 管线原则

- 不从任何商业游戏提取、描摹或重新分发模型、贴图、动画、UI 和音频；
- AI 位图通过项目 `scripts/imagegen` 调用配置 provider 生成，仓库不保存服务 URL 或密钥；
- 运行时模型、动画和音效均为项目代码原生生成；
- AI 输出先进入忽略版本控制的 `output/imagegen/`，人工检查后才转换到 `public/assets/`；
- 第十轮起，已采用且需要跨环境继续加工的原始 PNG 归档到 `artifacts/imagegen/`；截图仍由 `.gitignore` 排除；
- 确定性程序材质由仓库脚本生成，种子、周期、边缝阈值和派生参数必须可复现；
- albedo、normal 和 roughness 分离使用，不把颜色图长期当作法线替代；
- 被拒绝的泡沫初稿未进入运行时，第二版通过方向性和 2x2 平铺检查后采用。

## 已采用位图

### ART-001：标题主视觉

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/art/driftwake-key-art.webp` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x1152` |
| 实际尺寸 | `1672x941` |
| 用途 | 标题界面与移动设备能力页 |
| 检查 | 无文字、Logo、水印；前景钩具、木筏、漂流物与岛屿层次清晰 |

最终提示词：

```text
Use case: stylized-concept. Asset type: original game environment key art and title-screen background. Primary request: a polished first-person ocean survival scene on a small hand-built raft, with an original salvaged hook tool resting in the lower foreground, scattered driftwood and useful debris following a current across the water, and a compact lush island far on the horizon. Scene/backdrop: an immense open sea just after a brief tropical rain, broken clouds opening to clear morning light. Style/medium: premium stylized 3D game render with painterly PBR materials, hand-sculpted shapes, restrained detail, believable scale, and a distinctive original visual identity; not photorealistic and not based on any existing game. Composition/framing: cinematic 16:9 first-person establishing view, stable horizon in the upper third, raft construction visible along the lower third, clear central view into the playable ocean, readable foreground-to-horizon depth. Lighting/mood: fresh warm sunlight crossing cool sea light, soft cloud shadows, calm wonder with a trace of danger. Color palette: turquoise and deep green-blue water balanced by sun-bleached timber, oxidized metal, coral-red cord, green island foliage, and warm golden light. Materials/textures: salt-worn wood grain, wet rope fibers, hammered recycled metal, translucent water, crisp white foam. Constraints: fully original art; no logos, trademarks, copyrighted characters, recognizable branded UI, text, watermark, frame, or border. Avoid: direct resemblance to a specific commercial survival game, generic stock-art composition, exaggerated cartoon proportions, muddy colors, heavy bloom, dark vignette, blurred foreground, extra characters, boats, or buildings.
```

### TEX-001：风化雪松材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/weathered-cedar.webp`、`weathered-cedar-normal.webp`、`weathered-cedar-roughness.webp` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际尺寸 | `1254x1254`，各三张 |
| 用途 | 木筏、钩具木柄与木质漂流物 |
| 处理方式 | 审定 Image 2 albedo 保持不变；`derive_material_maps.py --strength 0.52 --roughness-min 178 --roughness-max 238` 补齐 normal/roughness |
| 检查 | 2x2 平铺无明显边缝；无透视、文字、金属件和强烘焙阴影；木筏/深木/工具柄均不再使用颜色图作 bump |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable game texture, PBR base-color albedo. Primary request: original salt-weathered reclaimed cedar planks for a hand-built ocean raft, with hand-painted stylized realism and subtle variation between gray-tan, muted honey, and sun-bleached fibers. Scene/backdrop: texture sheet only. Subject: longitudinal wood grain, shallow splits, softened edges, small repaired gouges, salt staining, and sparse faded coral-red cord marks; no separate objects. Style/medium: production-ready stylized game texture, painterly PBR albedo, crisp macro detail without photoreal noise. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrap on all four edges, medium-scale grain suitable for individual planks. Lighting/mood: flat neutral albedo with absolutely no baked directional light, cast shadow, ambient occlusion, highlights, or perspective. Color palette: weathered warm gray cedar, restrained honey fibers, tiny desaturated coral accents. Constraints: seamless tile; no nails, metal pieces, rope objects, typography, symbols, logos, watermark, frame, border, large knots, or unique focal marks. Avoid: repeating checker pattern, plank-end cuts, dramatic cracks, glossy varnish, photographic scanning artifacts, strong contrast, beveled tile presentation, material ball, or perspective preview.
```

### TEX-002：定向海面泡沫遮罩

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/ocean-foam-mask.png` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际尺寸 | `1254x1254` |
| 用途 | 海面着色器双尺度旋转采样 |
| 检查 | 2x2 平铺连续；约 80% 黑色留白；浪峰方向统一；初稿因大理石感被拒绝 |

最终提示词：

```text
Use case: stylized-concept
Asset type: seamless tileable grayscale game texture and directional ocean-foam shader mask
Primary request: create a sparse overhead mask of wind-driven open-ocean wave crests, with broken curved ribbons sweeping consistently from lower left toward upper right, fine torn spray at the leading edges, a few secondary short streaks, and three clearly different spatial scales
Scene/backdrop: a pure black data-texture field representing open water
Subject: disconnected white and gray crest lines only; at least 80 percent of the image must remain clean black open water
Style/medium: clean hand-authored procedural mask for a premium stylized 3D ocean shader, not a photograph and not a rendered water scene
Composition/framing: exact top-down orthographic square, strong coherent diagonal flow, broad irregular gaps, seamless wrapping on all four edges, no central focal point
Lighting/mood: none; data texture only
Color palette: strict grayscale from black through gray to white, no color
Constraints: seamless tile; edge continuity; varied opacity; no baked lighting, shadows, specular highlights, water color, horizon, text, symbols, logos, watermark, frame, or border
Avoid: closed cellular webs, honeycomb networks, marble veins, evenly filled lace, snow, clouds, smoke, paint splatter, radial whirlpool, dense white coverage, checker repetition, large isolated blobs
```

### TEX-003：深潮鲨皮肤材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `shark-skin.webp`、`shark-skin-normal.webp`、`shark-skin-roughness.webp` |
| 生成方式 | `scripts/generate_procedural_materials.py` 确定性原创生成；`scripts/derive_material_maps.py` 派生 |
| 实际尺寸 | 1024x1024，各三张 |
| 用途 | 深潮鲨主体、鳍与尾柄材质 |
| 检查 | 横/纵边缝平均差 0.43/0.49；无动物轮廓、鱼鳞、文字或独特重复焦点 |

实现包含三尺度周期噪声、两组整数频率细齿方向、微划痕、独立 normal 和 132-216 范围 roughness。AI 候选未成功返回，因此当前采用可复现程序版本，不把临时木纹复制品纳入仓库。

### TEX-004：编织棕榈纤维材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `woven-palm-fiber.webp`、`woven-palm-fiber-normal.webp`、`woven-palm-fiber-roughness.webp` |
| 生成方式 | `scripts/generate_procedural_materials.py` 确定性原创生成；`scripts/derive_material_maps.py` 派生 |
| 实际尺寸 | 1024x1024，各三张 |
| 用途 | 建造锤握把、木矛扎结、钓竿握把与后续收集网 |
| 检查 | 第一版规则格栅被拒绝；采用版横/纵边缝平均差 7.22/17.14，2x2 平铺无断边 |

采用版使用量化周期斜率、束内细丝、周期微弯、交替压覆、盐蚀和短促珊瑚红/海绿色修补线。独立 normal 强度 1.35，roughness 范围 196-250。

### TEX-005：浅礁海床材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `reef-seabed.webp`、`reef-seabed-normal.webp`、`reef-seabed-roughness.webp` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版统一为 1024x1024 WebP |
| 处理方式 | `scripts/prepare_imagegen_material.py` 半幅环移、中央不规则羽化、周期模糊与 PBR 图派生 |
| 用途 | 环岛浅礁海床、细砂矿点与水下材质基色 |
| 检查 | 2x2 平铺无明显硬边；边界差相对内部相邻差为 x=1.08 倍、y=1.15 倍；无文字、Logo、透视和烘焙光影 |

最终提示词：

```text
Create an original seamless tileable PBR base-color albedo texture for a stylized-realistic tropical shallow reef seabed in an original ocean survival game. Orthographic straight top-down material scan, evenly lit, absolutely no directional light or cast shadows, no perspective, no horizon. Fine pale mineral sand interwoven with weathered limestone fragments, muted shell grit, sparse olive sea-grass fragments and tiny restrained coral rubble accents in desaturated rust red, sea green and chalk white. Natural medium-scale variation with no obvious focal object and no repeated emblem. Crisp physically plausible micro-detail, authored game material quality, edge-to-edge seamless on all four sides. No text, no logo, no UI, no tools, no animals, no footprints, no water surface, no caustic lighting, no baked ambient occlusion, no photoreal stock-photo framing, and do not imitate any named game.
```

原始候选四边差为 x=23.85/y=27.50，内容质量通过但未直接入库。第一次“强制零差值”处理虽然数值为零，却在 2x2 预览出现十字对称带，因此被拒绝；采用版改为半幅环移，把自然连续区域移到四边，只在中央旧接缝使用不规则羽化。normal 强度 1.08，roughness 范围 174-238。

### TEX-006：拼补拾风帆材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `sail-cloth.webp`、`sail-cloth-normal.webp`、`sail-cloth-roughness.webp` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版统一为 1024x1024 WebP |
| 处理方式 | `scripts/prepare_imagegen_sail.py` 正方形裁切、色彩/对比约束、亮度门禁与 PBR 图派生 |
| 用途 | 拾风帆双面可变形帆布、桅顶风标 |
| 检查 | 正交平面材质；无透视、文字、标志、大洞和强烘焙光影；亮度均值 165.8、标准差 21.0 |

最终提示词：

```text
Use case: stylized-concept
Asset type: production material source for an original first-person ocean survival game sail
Primary request: A square, orthographic, evenly lit close-up swatch of hand-sewn off-white sailcloth made from layered reclaimed canvas and palm fiber. Dense visible woven fibers, salt bleaching, subtle teal-gray water stains, sun-faded warm ochre edges, small hand-stitched repairs and restrained rust marks. Mature stylized realism, physically plausible fabric, rich fine texture, quiet handcrafted character, no scene perspective.
Constraints: Texture only, edge-to-edge material coverage, uniform scale and illumination, no mast, no ropes, no horizon, no objects, no people, no symbols, no logo, no letters, no text, no watermark, no large holes, no dramatic shadows, no directional spotlight, no recognizable copyrighted design.
```

该帆面采用一次完整 UV，不要求强制平铺。处理脚本保留原图非重复的补丁与缝线布局，只压缩尺寸并派生法线/粗糙度；这样能避免平铺修复破坏手工修补叙事。源 PNG 保留在忽略版本控制的 `output/imagegen/`，运行时只引用审定后的三张 WebP。

### TEX-007：潮生培养土材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `planter-soil.webp`、`planter-soil-normal.webp`、`planter-soil-roughness.webp` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版统一为 1024x1024 WebP |
| 处理方式 | `scripts/prepare_imagegen_soil.py` 去饱和、对比约束、0.32 px 预滤波、半幅环移、中央不规则羽化与 PBR 图派生 |
| 用途 | 潮生作物盆培养土、浇水后的低透明湿润层底材 |
| 检查 | 正交平面；无植物、容器、工具、文字和烘焙光影；亮度均值 50.7、标准差 33.7；接缝 x=18.13/1.15x、y=19.79/1.15x |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable PBR base-color material for an original raft garden planter. Primary request: original hand-mixed tropical survival growing medium made from dark mineral compost, shredded coconut coir, pale shell grit, tiny charcoal fragments and sparse weathered leaf fibers. Scene/backdrop: texture sheet only. Style/medium: premium stylized-realistic game material, tactile hand-authored PBR albedo with crisp controlled micro-detail and believable organic variation. Composition/framing: exact orthographic top-down square, uniform texel density, seamless wrap on all four edges, no central focal object. Lighting/mood: flat neutral albedo with absolutely no baked directional light, highlights, cast shadows or ambient occlusion. Color palette: deep neutral umber and charcoal balanced with muted coconut tan, chalk shell specks and tiny desaturated moss-green fibers; restrained, not monochrome brown. Constraints: fully original, edge-to-edge soil coverage, no plants, sprouts, seeds, insects, tools, containers, hands, footprints, text, symbols, logos, watermark, frame or border. Avoid: wet glossy mud, gravel-only surface, large unique stones, dramatic contrast, photographic scan framing, perspective preview, material ball, repeated checker pattern or recognizable copyrighted design.
```

原始高频壳屑让通用处理流程的纵向接缝差达到 24.05，超过既定 24 门禁 0.05；没有放宽门禁。专用脚本先做亚像素预滤波和轻度去饱和，再执行同一环移羽化流程，最终横纵绝对差与相对内部差全部通过。源 PNG 保留在忽略版本控制的 `output/imagegen/`。

### TEX-008：回潮耐火陶土材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `refractory-clay.webp`、`refractory-clay-normal.webp`、`refractory-clay-roughness.webp` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版统一为 1024x1024 WebP |
| 处理方式 | `scripts/prepare_imagegen_material.py` 半幅环移、中央不规则羽化、周期模糊与 PBR 图派生；seam 168、normal 0.94、roughness 184-242 |
| 用途 | 回潮熔炉耐火砖、炉口和热工陶土构件 |
| 检查 | 正交材质；无熔炉、工具、火焰、文字和烘焙光影；接缝 x=13.58/1.00x、y=15.75/1.27x，2x2 平铺无硬边 |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable PBR base-color material for original raft smelting equipment. Primary request: original hand-fired refractory clay composite made from muted red tidal clay, pale shell aggregate, dark charcoal inclusions, mineral bloom and sparse hammered metal dust, weathered by salt air but structurally dense. Scene/backdrop: texture sheet only. Style/medium: premium stylized-realistic game material, tactile hand-authored PBR albedo with crisp controlled micro-detail and physically plausible ceramic variation. Composition/framing: exact orthographic top-down square, uniform texel density, seamless wrap on all four edges, no central focal object, no recognizable brick layout. Lighting/mood: flat neutral albedo with absolutely no baked directional light, highlights, cast shadows or ambient occlusion. Color palette: desaturated iron-red clay, charcoal gray, chalk shell flecks and cool mineral teal traces, balanced and not monochrome orange or brown. Constraints: fully original, edge-to-edge refractory material coverage, no furnace, tools, flames, molten metal, hands, footprints, text, symbols, logos, watermark, frame or border. Avoid: wet glossy mud, large cracks, dramatic contrast, photographic scan framing, perspective preview, material ball, repeated checker pattern, masonry wall pattern or recognizable copyrighted design.
```

源图内容、色彩层次和颗粒尺度通过人工检查，直接使用通用材质处理脚本即通过既定绝对差和相对差门禁，没有降低质量或放宽阈值。normal 与 roughness 独立派生，运行时三图均使用 1024 分辨率；源 PNG 保留在忽略版本控制的 `output/imagegen/`。

### TEX-009：盐蚀导航合金材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `navigation-alloy.webp`、`navigation-alloy-normal.webp`、`navigation-alloy-roughness.webp` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版统一为 1024x1024 WebP |
| 处理方式 | `scripts/prepare_imagegen_material.py` 半幅环移、172 px 中央不规则羽化、周期模糊与 PBR 图派生；normal 0.82、roughness 128-210 |
| 用途 | 定潮舵台轮缘、面板、罗盘环、航线针、齿轮与强化帆横撑/锁扣 |
| 检查 | 无舵轮、仪表、铆钉布局、文字和烘焙高光；接缝 x=13.00/0.91x、y=14.74/1.15x，未放宽阈值 |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable PBR base-color material for original raft navigation instruments and helm hardware. Primary request: an original salt-aged marine navigation alloy combining hand-planished phosphor bronze, pale copper-nickel flecks, restrained blue-green verdigris traces, graphite grease held in fine working grooves, and tiny chalky salt blooms, maintained enough to remain mechanically sound. Scene/backdrop: texture sheet only. Style/medium: premium stylized-realistic game material, tactile hand-authored PBR albedo with crisp controlled micro-detail and physically plausible metal aging. Composition/framing: exact orthographic top-down square, uniform texel density, seamless wrap on all four edges, no central focal object, no recognizable compass, dial, plate, rivet layout or manufactured part. Lighting/mood: flat neutral albedo with absolutely no baked directional light, highlights, reflections, cast shadows or ambient occlusion. Color palette: muted old-gold bronze, cool nickel gray, sparse mineral teal patina and chalk salt traces, balanced and not monochrome orange, brown or green. Constraints: fully original, edge-to-edge alloy material coverage, no helm, wheel, compass, lettering, numbers, symbols, tools, hands, text, logos, watermark, frame or border. Avoid: polished mirror metal, heavy corrosion holes, large scratches, dramatic contrast, photographic scan framing, perspective preview, material ball, repeated checker pattern, stamped decoration or recognizable copyrighted design.
```

源图没有可识别制造件或中心焦点，色彩在旧金、冷镍灰和少量矿物青锈之间保持平衡。运行时保留金属度和独立 roughness，不使用颜色图假装金属高光；源 PNG 保留在忽略版本控制的 `output/imagegen/`。

### TEX-010：海上飑云天空材质

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `storm-clouds.webp` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版为 1024x1024 WebP、165 kB |
| 处理方式 | `scripts/prepare_imagegen_material.py` 半幅环移与 48 px 中央羽化；normal/roughness 仅作离线检查，天空运行时只采用颜色纹理 |
| 用途 | 相机跟随的内向风暴云穹顶、闪电染色和远雨背景 |
| 检查 | 无地平线、海面、船只、风眼、闪电、文字和中心构图；接缝 x=3.11/1.26x、y=2.26/0.80x，2x2 平铺无硬边 |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable color texture for a full-bleed 3D marine storm-cloud sky dome in an original survival game. Primary request: an original dense ocean squall ceiling made of layered rolling cumulonimbus, broad charcoal masses, cooler blue-green gray vapor shelves, soft rain curtains and smaller turbulent cloud pockets, dramatic and threatening but still readable behind game silhouettes. Scene/backdrop: cloud field only with no horizon, viewed as an enveloping overcast canopy rather than a landscape photograph. Style/medium: premium stylized-realistic hand-authored game sky texture, painterly volumetric cloud structure with controlled high-frequency detail and broad readable forms. Composition/framing: exact square, evenly distributed cloud density, seamless wrap on all four edges, no central vortex or focal opening, usable when repeated around a large sky sphere. Lighting/mood: diffuse storm illumination from within the overcast, deep slate undersides and restrained cold silver edge scatter, absolutely no sun disc, directional sunset, lightning bolt or hard cast shadow. Color palette: graphite gray, cool mineral teal, desaturated steel blue and pale rain-silver accents; balanced, not monochrome blue or black. Constraints: fully original, edge-to-edge cloud coverage, enough midtone variation for rain streak contrast, no horizon, ocean, island, boat, aircraft, birds, people, text, logo, watermark, frame or border. Avoid: bright white daytime sky, fantasy nebula, smoke explosion, tornado eye, circular composition, photographic panorama seams, repeated checker pattern, purple palette, orange sunset, visible stars or recognizable copyrighted imagery.
```

初次 172/286/96 px 过渡带均因相对内部差异门禁失败，没有降低阈值；48 px 版本保持大尺度云体并通过原门禁。运行时云穹顶与物理天空分层，不把位图中的雨帘当作近景雨线，近景仍由实例化 VFX 独立驱动。

### TEX-011：盐蚀集热玻璃材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `saltglass-collector.webp`、`saltglass-collector-normal.webp`、`saltglass-collector-roughness.webp` |
| 采用源图 | `artifacts/imagegen/saltglass-collector-raw.png` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版统一为 1024x1024 WebP |
| 处理方式 | `scripts/prepare_imagegen_material.py` 半幅环移、中央不规则羽化、周期模糊与 PBR 图派生 |
| 用途 | 潮镜五联净水器斜置集热板与盐蚀表面层次 |
| 检查 | 无完整装置、杯具、文字、标志和烘焙高光；接缝 x=8.38/1.02x、y=8.79/1.19x，2x2 平铺无硬边 |

采用提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable PBR base-color material for an original solar water collector. Primary request: original salt-aged translucent collector glass made from pale aqua recycled panes, fine mineral frosting, faint hammered waviness, sparse chalk-white salt blooms and restrained warm amber sealing traces. Scene/backdrop: texture sheet only. Style/medium: premium stylized-realistic hand-authored game material with controlled tactile micro-detail and broad readable variation. Composition/framing: exact orthographic top-down square, uniform texel density, seamless wrapping on all four edges, no central focal object or manufactured panel layout. Lighting/mood: flat neutral albedo with no baked directional light, reflection, highlight, cast shadow or ambient occlusion. Constraints: fully original edge-to-edge material; no purifier, frame, cup, pipe, text, symbols, logos, watermark or border. Avoid: mirror glass, window scene, stained-glass imagery, large cracks, photographic perspective, material ball, repeated checker pattern or recognizable copyrighted design.
```

运行时由独立 normal/roughness 提供盐晶与玻璃起伏，不把源图高光当作透明效果；净水器本体另用五个透明杯体和动态水位表达功能状态。

### TEX-012：蜡封密舱帆布材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `sealed-canvas.webp`、`sealed-canvas-normal.webp`、`sealed-canvas-roughness.webp` |
| 采用源图 | `artifacts/imagegen/sealed-canvas-raw.png` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版统一为 1024x1024 WebP |
| 处理方式 | `scripts/prepare_imagegen_material.py` 半幅环移、中央不规则羽化、周期模糊与 PBR 图派生 |
| 用途 | 干舱储物柜柜门、顶盖和侧面密封补片 |
| 检查 | 无箱体、扣具、文字、标志和烘焙阴影；接缝 x=15.29/1.23x、y=15.05/1.10x，2x2 平铺无硬边 |

采用提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable PBR base-color material for an original raft dry-storage locker. Primary request: original wax-sealed marine canvas woven from charcoal teal reclaimed fibers, with compressed waterproof grain, subtle graphite wax rub, sparse salt-gray abrasion, tiny oxidized-brass dust and restrained hand-mended thread variation. Scene/backdrop: texture sheet only. Style/medium: premium stylized-realistic game material, tactile and dense rather than photographic fabric noise. Composition/framing: exact orthographic top-down square, uniform texel density, seamless wrapping on all four edges, no central patch or recognizable bag pattern. Lighting/mood: flat neutral albedo with no baked directional light, highlights, cast shadows or ambient occlusion. Constraints: fully original edge-to-edge material; no chest, straps, buckles, labels, text, symbols, logos, watermark, frame or border. Avoid: leather, denim, camouflage, glossy plastic tarp, large tears, perspective preview, material ball, checker repetition or recognizable copyrighted design.
```

源图保留 C2PA 生成来源信息并随仓库归档；运行时 WebP 经统一门禁派生，柜体的木框、潮铸铰链、把手和八个内容标记均为代码原生几何。

### TEX-013：潮听信号层压板材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `signal-laminate.webp`、`signal-laminate-normal.webp`、`signal-laminate-roughness.webp` |
| 采用源图 | `artifacts/imagegen/signal-laminate-raw.png` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版统一为 1024x1024 WebP |
| 处理方式 | `scripts/prepare_imagegen_material.py`，seam 176、normal 0.90、roughness 158-226 |
| 用途 | 接收台机壳、扫描面板、阵列相位箱与中继浮标甲板 |
| 检查 | 无接收器、电路图、刻度、文字、标志或烘焙高光；接缝 x=17.39/1.01x、y=16.81/1.07x |

采用提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable PBR base-color material for original ocean-survival radio equipment. Primary request: an original salt-aged signal laminate pressed from deep mineral green-black resin, pale mica fiber threads, fine hand-planished brass dust, sparse cool nickel contact flecks and chalk-white salt blooms, dense and mechanically sound. Scene/backdrop: texture sheet only. Style/medium: premium stylized-realistic hand-authored game material with tactile broad variation and crisp controlled micro-detail. Composition/framing: exact orthographic top-down square, uniform texel density, seamless wrapping on all four edges, no central focal object and no manufactured panel layout. Lighting/mood: flat neutral albedo with absolutely no baked directional light, reflections, highlights, cast shadows or ambient occlusion. Constraints: fully original edge-to-edge material; no receiver, antenna, circuit diagram, dial, screen, rivet pattern, text, numbers, symbols, logos, watermark, frame or border. Avoid: polished plastic, carbon fiber checker weave, monochrome navy, heavy orange rust, large cracks, photographic scan framing, perspective preview, material ball or recognizable copyrighted design.
```

### TEX-014：烟暗磷光玻璃材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `phosphor-glass.webp`、`phosphor-glass-normal.webp`、`phosphor-glass-roughness.webp` |
| 采用源图 | `artifacts/imagegen/phosphor-glass-raw.png` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版统一为 1024x1024 WebP |
| 处理方式 | `scripts/prepare_imagegen_material.py`，seam 176、normal 0.48、roughness 94-166 |
| 用途 | 接收台扫描玻璃、阵列绝缘子与中继标发光核心；运行时克隆材质驱动断电/发光状态 |
| 检查 | 无雷达环、扫描线、网格、文字、标志或烘焙光晕；接缝 x=6.49/0.93x、y=6.63/1.01x |

采用提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable PBR base-color material for an original marine scanning display. Primary request: original smoke-dark phosphor glass composite with layered petroleum teal, muted bottle green and cool charcoal depth, fine mineral frosting, subtle cathode-grain specks, sparse pale aqua salt etching and restrained warm brass-dust traces around the material, readable when softly emissive but dark when unpowered. Scene/backdrop: texture sheet only. Style/medium: premium stylized-realistic hand-authored game material, controlled optical depth and fine tactile micro-detail without photographic noise. Composition/framing: exact orthographic top-down square, uniform texel density, seamless wrapping on all four edges, no central focal point or display graphic. Lighting/mood: flat neutral albedo with no baked glow, directional light, reflection, highlight, shadow or ambient occlusion. Constraints: fully original edge-to-edge glass material; no radar sweep, circles, map, grid, dots, text, numbers, symbols, logos, watermark, frame or border. Avoid: bright cyan dominance, stained glass, mirror reflection, window scene, star field, large cracks, perspective preview, material ball, checker repetition or recognizable copyrighted design.
```

### TEX-015：盐封打捞手套材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `saltsealed-glove.webp`、`saltsealed-glove-normal.webp`、`saltsealed-glove-roughness.webp` |
| 采用源图 | `artifacts/imagegen/saltsealed-glove-raw.png` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际输出 | 1254x1254 PNG；采用版统一为 1024x1024 WebP |
| 处理方式 | `scripts/prepare_imagegen_material.py --optimize-boundary`，seam 96、normal 0.72、roughness 176-238 |
| 用途 | 第一人称双手前臂、掌体、八组双段手指与双拇指；麻编掌垫和金属扣件继续使用独立材质 |
| 检查 | 无手套轮廓、手指、成品接缝、扣件、文字或烘焙阴影；接缝 x=19.35/1.16x、y=20.83/0.81x，2x2 平铺无硬边 |

采用提示词：

```text
Use case: stylized-concept
Asset type: seamless tileable game texture, production PBR base-color albedo for a first-person ocean-survival glove
Primary request: an original salt-sealed technical canvas weave made from waxed marine cloth and tightly interlaced salvage fibers, with subtle abrasion, tiny salt crystals, compressed grip wear and sparse short repair threads
Scene/backdrop: texture sheet only
Subject: continuous small-scale material surface with dense diagonal canvas weave, fine wax-filled pores, restrained frayed microfibers and believable irregular tension; no finished glove or separate objects
Style/medium: premium hand-painted stylized realism, crisp controlled high-frequency detail suitable for a close first-person asset, not photographic noise
Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, no central focal point and no large directional stripe
Lighting/mood: flat neutral albedo with absolutely no baked directional light, cast shadow, ambient occlusion, highlights, gloss or perspective
Color palette: desaturated sea-glass green, cool weathered gray, pale salt residue, sparse muted coral-red and old brass repair fibers; balanced and not monochrome teal
Materials/textures: compact waxed fibers, fine woven grain, shallow scuffs smaller than a fingertip, salt lodged between threads
Constraints: fully original; seamless tile; no text, symbols, logos, watermark, border, frame, recognizable branded pattern or unique focal scar
Avoid: glove silhouette, fingers, palm shape, seams crossing the whole image, large patches, eyelets, buckles, rope coils, leather, denim, camouflage, knitted wool, glossy plastic, dramatic stains, strong shadows, material sphere, perspective preview, obvious repeating cells
```

初次以 144、192、96 和 48 px 羽化带处理时，纵向绝对差仍为 26.66-28.51，未放宽绝对 24 / 相对 1.35 倍门禁。通用处理器新增显式 `--optimize-boundary` 选项，在不改变默认行为的前提下把原图最自然的相邻行列移动到周期边界，再执行原有不规则羽化；最终边界偏移为 `(1,1023)`，三张运行时贴图通过人工内容、2x2 平铺和数值门禁。源 PNG、模型参数和完整提示词随仓库归档，来源链由本清单与提交记录保留。

### TEX-016：银脊鱼皮材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/silver-spine-skin.webp`、`silver-spine-skin-normal.webp`、`silver-spine-skin-roughness.webp` |
| 采用源图 | `artifacts/imagegen/silver-spine-skin-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 银脊鱼躯干、鳍面与鳞脊细节 |
| 处理方式 | `scripts/prepare_imagegen_material.py`，seam 156、normal 0.58、roughness 118-196 |
| 检查 | 无完整鱼体/文字/标志/烘焙光影；接缝 x=9.35/1.29x、y=11.31/1.14x；1024x640 大型捕获近景、六贴图绑定与预热通过 |

最终提示词：

```text
Asset type: seamless tileable game texture, PBR base-color albedo. Primary request: original skin surface for the Silver Spine, a small open-ocean survival fish, with fine overlapping cycloid scales, a cool pearl-silver base, subtle sea-green countershading, a narrow broken pale dorsal tracer, and sparse graphite pin marks. Subject: continuous fish skin material only, no whole fish, silhouette, eye, mouth, gill, fin, tail, bones, flesh, or separate object. Style/medium: premium production-ready hand-painted stylized realism, crisp controlled scale detail, painterly PBR albedo matching a polished 3D survival game. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, directional scales running horizontally with irregular natural rhythm, no central focal point. Lighting: perfectly flat neutral base color with absolutely no baked directional lighting, cast shadows, ambient occlusion, specular highlights, wet gloss, depth-of-field, or perspective. Color palette: pearl gray, muted blue-green, pale celadon, tiny charcoal accents; bright and readable without monochrome blue dominance. Constraints: fully original, seamless tile, no text, symbols, logos, watermark, frame, border, anatomical feature, dramatic stripe, unique scar, or recognizable branded design. Avoid: photographic scan noise, reptile scales, shark denticles, checker repetition, material sphere, product mockup, background scene, heavy contrast, neon color, and existing commercial-game resemblance.
```

### TEX-017：琥鳍鲷鱼皮材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/amber-fin-skin.webp`、`amber-fin-skin-normal.webp`、`amber-fin-skin-roughness.webp` |
| 采用源图 | `artifacts/imagegen/amber-fin-skin-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 琥鳍鲷躯干、鳍面与铜琥珀斑组 |
| 处理方式 | `scripts/prepare_imagegen_material.py`，seam 156、normal 0.62、roughness 126-204 |
| 检查 | 无完整鱼体/文字/标志/烘焙光影；接缝 x=9.42/1.14x、y=6.86/1.20x；1024x640 大型捕获近景、六贴图绑定与预热通过 |

最终提示词：

```text
Asset type: seamless tileable game texture, PBR base-color albedo. Primary request: original skin surface for the Amber Fin Bream, a deep-bodied reef-edge survival fish, with medium rounded overlapping scales, a warm copper-amber base, restrained ochre fin-root flecks, soot-gray broken vertical band fragments, and small weathered teal iridescent notes. Subject: continuous fish skin material only, no whole fish, silhouette, eye, mouth, gill, fin, tail, bones, flesh, or separate object. Style/medium: premium production-ready hand-painted stylized realism, tactile painterly PBR albedo with deliberate color layering suitable for close first-person inspection. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on every edge, naturally staggered scale rows and irregular band fragments, no central focal point. Lighting: perfectly flat neutral base color with absolutely no baked directional lighting, cast shadows, ambient occlusion, specular highlights, wet gloss, depth-of-field, or perspective. Color palette: burnt amber, soft copper, muted saffron, charcoal gray, restrained oxidized teal; warm but not brown-dominated. Constraints: fully original, seamless tile, no text, symbols, logos, watermark, frame, border, anatomical feature, unique scar, or recognizable branded design. Avoid: gold foil, koi patterns, tropical neon, reptile skin, checker repetition, material sphere, product mockup, background scene, heavy black bands, and existing commercial-game resemblance.
```

### TEX-018：旗尾梭鱼皮材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/sailtail-runner-skin.webp`、`sailtail-runner-skin-normal.webp`、`sailtail-runner-skin-roughness.webp` |
| 采用源图 | `artifacts/imagegen/sailtail-runner-skin-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 旗尾梭躯干、鳍面与青灰流线细节 |
| 处理方式 | `scripts/prepare_imagegen_material.py`，seam 48、normal 0.54、roughness 114-190 |
| 检查 | 宽羽化/边界优化版因纵向处理带被拒绝；采用版接缝 x=4.07/1.25x、y=14.32/1.12x；1024x640 中型捕获近景、六贴图绑定与预热通过 |

最终提示词：

```text
Asset type: seamless tileable game texture, PBR base-color albedo. Primary request: original skin surface for the Sailtail Runner, a fast elongated pelagic survival fish, with very fine swept scales, a slate-cyan base, long broken aquamarine current lines, pale flax-gold micro accents, and restrained indigo mottling that implies speed without forming a logo or emblem. Subject: continuous fish skin material only, no whole fish, silhouette, eye, mouth, gill, fin, sail, tail, bones, flesh, or separate object. Style/medium: premium production-ready hand-painted stylized realism, elegant directional PBR albedo, crisp close-range detail without photographic noise. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, fine horizontal flow with naturally varied interruptions, no central focal point. Lighting: perfectly flat neutral base color with absolutely no baked directional lighting, cast shadows, ambient occlusion, specular highlights, wet gloss, depth-of-field, or perspective. Color palette: muted cyan, blue-gray, pale flax, restrained indigo and sea-glass green; balanced against warm raft materials and not a one-note navy surface. Constraints: fully original, seamless tile, no text, symbols, logos, watermark, frame, border, anatomical feature, dramatic unique stripe, or recognizable branded design. Avoid: racing decals, marlin anatomy, reptile skin, checker repetition, material sphere, product mockup, background scene, neon blue, heavy gloss, and existing commercial-game resemblance.
```

### TEX-019：鲜鱼肉材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/fresh-fish-flesh.webp`、`fresh-fish-flesh-normal.webp`、`fresh-fish-flesh-roughness.webp` |
| 采用源图 | `artifacts/imagegen/fresh-fish-flesh-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 基础烤架与三槽烤台的鲜鱼段形体 |
| 处理方式 | `scripts/prepare_imagegen_material.py --optimize-boundary`，seam 168、normal 0.44、roughness 148-216 |
| 检查 | 无完整鱼体/骨骼/器官/器具/文字/烘焙光影；接缝 x=3.28/1.00x、y=5.17/0.97x；基础烤架与三槽生/熟/焦同屏通过 |

最终提示词：

```text
Asset type: seamless tileable game texture, PBR base-color albedo. Primary request: original freshly prepared ocean-fish flesh surface for a stylized survival cooking system, with clean coral-pink muscle grain, pale cream connective lines, sparse muted ruby capillaries, and subtle natural variation suitable for a hand-cut fillet. Subject: continuous boneless fish flesh material only, no whole fish, skin, scales, bones, organs, blood pool, knife, plate, food garnish, or separate object. Style/medium: premium production-ready hand-painted stylized realism, appetizing but grounded painterly PBR albedo with readable fibers and restrained detail. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, softly directional muscle fibers with irregular natural rhythm, no central focal point. Lighting: perfectly flat neutral base color with absolutely no baked directional lighting, cast shadows, ambient occlusion, highlights, wet gloss, depth-of-field, or perspective. Color palette: coral salmon, pale shell cream, muted rose and tiny wine-red accents; clean, fresh, and not plastic. Constraints: fully original, seamless tile, no text, symbols, logos, watermark, frame, border, anatomy cross-section, gore, unique mark, or recognizable branded design. Avoid: raw meat product photography, tuna steak rings, marbling like beef, glossy slime, gore, checker repetition, material sphere, product mockup, background scene, and existing commercial-game resemblance.
```

### TEX-020：远洋鱼虹膜材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/pelagic-fish-eye.webp`、`pelagic-fish-eye-normal.webp`、`pelagic-fish-eye-roughness.webp` |
| 采用源图 | `artifacts/imagegen/pelagic-fish-eye-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 三种钓获鱼的圆形虹膜、瞳孔与眼缘细节 |
| 处理方式 | `scripts/prepare_imagegen_eye.py` 保留非重复中心布局，normal 0.28、roughness 58-138 |
| 检查 | 无眼睑/鱼头/文字/烘焙高光；径向亮度 pupil=2.0、iris=105.5、edge=3.9；三鱼种捕获近景的虹膜、瞳孔、眼缘尺度与朝向通过 |

最终提示词：

```text
Use case: stylized-concept
Asset type: production game texture, non-tileable circular eye decal and PBR base-color albedo
Primary request: an original open-ocean fish iris viewed straight-on, with a deep charcoal round pupil, a layered sea-glass teal iris, pale celadon radial fibers, sparse warm amber flecks, and a narrow dark limbal ring; designed for three original stylized-realistic survival-game fish species
Scene/backdrop: texture sheet only, the circular eye centered on a uniform near-black outer field that can be clipped by round geometry
Subject: one centered circular iris and pupil only; no eyelids, skin, scales, fish head, lashes, blood vessels, tears, animal silhouette, or separate objects
Style/medium: premium hand-painted stylized realism, production-ready PBR albedo with crisp radial detail and controlled painterly variation, readable in a close first-person catch animation without looking cartoonish or photoreal scanned
Composition/framing: exact top-down orthographic square, pupil exactly centered, iris fills about 82 percent of the canvas, complete circular limbal edge with generous even padding, no perspective and no off-center crop
Lighting: flat neutral base color with no baked directional light, reflection, catchlight, cast shadow, ambient occlusion, wet gloss, depth-of-field, or three-dimensional eyeball shading
Color palette: charcoal black, mineral teal, pale celadon, restrained old-gold amber and tiny cool gray fibers; balanced and not monochrome blue
Constraints: fully original; exact centered circular design; no text, numbers, symbols, logos, watermark, frame, border, recognizable branded motif, or resemblance to a specific commercial game
Avoid: human eye anatomy, cat/reptile slit pupil, giant black featureless sphere, cute cartoon eye, neon cyan, red eye, photographic macro image, glossy baked highlight, material ball, perspective preview, multiple eyes, and background scene
```

### TEX-021：火烤熟鱼肉材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/cooked-fish-flesh.webp`、`cooked-fish-flesh-normal.webp`、`cooked-fish-flesh-roughness.webp` |
| 采用源图 | `artifacts/imagegen/cooked-fish-flesh-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 基础烤架与三槽烤台达到熟制窗口后的鱼排表面 |
| 处理方式 | `scripts/prepare_imagegen_material.py --optimize-boundary`，seam 168、normal 0.44、roughness 150-214 |
| 检查 | 以 TEX-019 为编辑目标，保持相同鱼肉尺度和片层；接缝 x=4.95/0.89x、y=7.28/0.93x；基础真实收取与三槽同屏通过 |

最终提示词：

```text
Transform the provided original seamless fresh ocean-fish flesh albedo into a production-ready seamless fire-roasted fish surface for a premium stylized-realistic survival game. Preserve the source's directional muscle grain, fine connective lines, uniform texel density, edge continuity, and painterly material scale, but cook it through: opaque pearl flakes, toasted coral and muted apricot fibers, restrained golden-brown ridges, tiny dry blister freckles, and sparse pale salt crystals. The result must remain a continuous material texture only, not a whole fillet, steak, fish, food object, plate, grill, cookware, garnish, fire, smoke, shadow, or scene. Exact top-down orthographic square texture, seamless on all four edges, no central focal point, no large crust patch, no unique burn mark, and no repeating cells. Flat neutral PBR base-color albedo with absolutely no baked directional lighting, cast shadow, ambient occlusion, specular highlight, wet gloss, depth-of-field, or perspective. Fully original; no text, symbols, logos, watermark, frame, branded motif, or resemblance to a specific commercial game. Keep it appetizing and grounded rather than plastic, neon, photographic, beef-like, raw-looking, or heavily charred.
```

### TEX-022：焦黑鱼肉材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/burnt-fish-flesh.webp`、`burnt-fish-flesh-normal.webp`、`burnt-fish-flesh-roughness.webp` |
| Image 2 原始编辑 | `artifacts/imagegen/burnt-fish-flesh-image2-raw.png` |
| 采用源图 | `artifacts/imagegen/burnt-fish-flesh-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 基础烤架与三槽烤台超过收取窗口后的焦鱼惩罚表面 |
| 处理方式 | Image 2 最终编辑源离线亮度 `1.72`、饱和度 `0.92`，再由 `prepare_imagegen_material.py --optimize-boundary` 以 seam 168、normal 0.50、roughness 178-236 处理 |
| 检查 | 第一版因树皮感拒绝并删除；第二版缩到鱼排后与熟鱼区分不足；最终编辑原图亮度 45.30，未直接上线，采用可审计提亮版后运行图亮度 77.3，接缝 x=18.01/1.11x、y=19.34/0.93x；三槽同屏焦斑清晰且无黑块 |

初始过熟编辑提示词：

```text
Transform the provided original seamless cooked ocean-fish flesh albedo into a production-ready seamless overcooked fish surface for a premium stylized-realistic survival game. Preserve the exact thin flaky fish-muscle shapes, pale connective lines, diagonal grain scale, uniform texel density, and edge continuity of the input. Dry and overcook those same flakes with a warm chestnut base, irregular toasted umber edges, small charcoal freckles, tiny blister spots, sparse pale salt ash, and only occasional coin-sized matte scorch patches covering less than one third of the image. Most flakes must remain visibly fish-like and warm brown; do not create long black bands, thick splinters, bark ridges, wood grain, cracked rock, or a dark continuous crust. Continuous material texture only, not a whole fillet, steak, fish, food object, plate, grill, cookware, flame, glowing ember, smoke, shadow, or scene. Exact top-down orthographic square texture, seamless on all four edges, no central focal point, no large unique scorch mark, no long crack, and no repeating cells. Flat neutral PBR base-color albedo with absolutely no baked directional lighting, cast shadow, ambient occlusion, specular highlight, oily gloss, depth-of-field, or perspective. Fully original; no text, symbols, logos, watermark, frame, branded motif, or resemblance to a specific commercial game. Avoid pure black, tree bark, timber fibers, mulch, volcanic rock, rusted metal, beef crust, photographic scan noise, gore, dramatic lighting, and background scenes.
```

最终针对性编辑提示词：

```text
Use case: precise-object-edit
Asset type: seamless tileable PBR albedo texture for a premium stylized-realistic survival game
Input images: Image 1 is the edit target, an overcooked ocean-fish flesh texture
Primary request: change only the degree and readability of charring. Deepen the same fish flakes from orange-brown to a clearly overcooked dark chestnut and mahogany range, add many small irregular charcoal-brown freckles, crisp short toasted edges, and scattered matte scorch islands so the material remains unmistakably burnt when reduced to a small game prop. The result should read roughly 45 percent darker than normal cooked fish while retaining warm brown variation.
Materials/textures: preserve the exact thin flaky fish-muscle shapes, pale connective seams, diagonal grain scale, uniform texel density, and seamless edge continuity of Image 1. Every mark must follow or cross short fish flakes rather than forming long fibers.
Composition/framing: exact top-down orthographic square material texture, continuous across all four edges, no central focal point, no large unique mark, no repeating cells.
Lighting/mood: flat neutral PBR base-color albedo; no baked directional light, cast shadow, ambient occlusion, specular highlight, oily gloss, depth of field, or perspective.
Constraints: edit only color value and short local scorch detail; preserve fish anatomy and original scale; no whole fillet, fish, plate, grill, cookware, flame, ember, smoke, scene, text, symbol, logo, watermark, or frame; fully original.
Avoid: pure black, a continuous black crust, long black bands, bark, timber fibers, wood grain, splinters, mulch, cracked rock, volcanic stone, rusted metal, beef crust, gore, photographic scan noise, dramatic lighting, and background scenes.
```

### TEX-023：耐热折铁材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/saltfire-folded-iron.webp`、`saltfire-folded-iron-normal.webp`、`saltfire-folded-iron-roughness.webp` |
| 采用源图 | `artifacts/imagegen/saltfire-folded-iron-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 基础净水器热碗/导流金属、基础烤架火盆/炉条，以及三槽烤台炉口/十三根炉条 |
| 处理方式 | `scripts/prepare_imagegen_material.py --optimize-boundary`，seam 144、normal 0.68、roughness 138-220 |
| 检查 | 无现成器具、铆钉阵列或烘焙高光；boundary=(921,1)，接缝 x=5.11/1.01x、y=5.75/0.86x；基础设备与三槽近景均通过 |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable game texture, production PBR base-color albedo. Primary request: an original heat-folded salvaged marine iron surface for hand-built ocean-survival grills and stills, with dense hammer planishing, shallow salt pitting, restrained blue-black mill oxide, muted warm heat-temper clouds, sparse dull iron-gray scuffs, and tiny soot deposits embedded in the grain. Subject: continuous forged iron material only, no cookware, grill, grate, bowl, machine, rivets, bolts, seams, holes, separate plates, fire, embers, text, symbols, or objects. Style/medium: premium hand-painted stylized realism, tactile production-ready PBR albedo with controlled close-range detail and deliberate painterly variation, not photographic scan noise. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, irregular microstructure with no central focal point and no long directional band. Lighting: perfectly flat neutral base color with absolutely no baked directional light, cast shadows, ambient occlusion, highlights, reflections, wet gloss, depth-of-field, or perspective. Color palette: charcoal iron, cool gunmetal, restrained indigo oxide, muted copper-brown heat stain, pale salt-gray pin marks; dark but readable and not a one-note black surface. Constraints: fully original, seamless tile, no text, numbers, logos, watermark, frame, border, unique scar, recognizable branded pattern, or resemblance to a specific commercial game. Avoid: corrugated sheet, diamond plate, brushed stainless steel, shiny chrome, heavy orange rust, repeating rivet grid, large cracks, fantasy runes, material sphere, product mockup, background scene, and dramatic lighting.
```

### TEX-024：盐蚀聚合物材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/salt-etched-polymer.webp`、`salt-etched-polymer-normal.webp`、`salt-etched-polymer-roughness.webp` |
| 采用源图 | `artifacts/imagegen/salt-etched-polymer-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 基础净水器透明集水杯的表面层/杯沿，以及潮镜五联净水器盆体 |
| 处理方式 | `scripts/prepare_imagegen_material.py --optimize-boundary`，seam 144、normal 0.38、roughness 118-194 |
| 检查 | 无现成杯盆、回收标志、透明高光或大裂纹；boundary=(1,1)，接缝 x=8.92/1.07x、y=8.36/0.88x；基础设备近景与材质绑定通过 |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable game texture, production PBR base-color albedo. Primary request: an original reclaimed marine polymer surface for an ocean-survival water purifier basin and cup rim, with compact molded grain, cloudy salt bloom, fine crossed cleaning scratches, subtle pressure whitening, sparse sea-glass inclusions, and small worn edges expressed only as micro color variation. Subject: continuous weathered polymer material only, no cup, basin, container, sheet edge, molded part, logo, recycling mark, text, symbols, water droplets, separate objects, or transparency cutout. Style/medium: premium hand-painted stylized realism, clean production-ready PBR albedo with crisp controlled microdetail suitable for close first-person inspection, not photographic noise. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, evenly distributed wear with no central focal point, large stripe, panel line, or repeating cell. Lighting: perfectly flat neutral base color with absolutely no baked directional light, cast shadows, ambient occlusion, specular highlights, reflections, wet gloss, depth-of-field, or perspective. Color palette: pale mineral gray, desaturated sea-glass green, cool ivory, restrained oxidized teal scratches, tiny warm salvage-plastic flecks; bright and balanced, not monochrome cyan. Constraints: fully original, seamless tile, no text, numbers, logos, watermark, frame, border, branded resin pattern, or resemblance to a specific commercial game. Avoid: glossy new plastic, translucent product render, bubble wrap, rubber, fabric weave, camouflage, large stains, strong cracks, material sphere, product mockup, background scene, and dramatic lighting.
```

### TEX-025：盐冠活叶材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/salt-crown-leaf.webp`、`salt-crown-leaf-normal.webp`、`salt-crown-leaf-roughness.webp` |
| 采用源图 | `artifacts/imagegen/salt-crown-leaf-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 盐冠作物的茎节与九片生长叶面 |
| 处理方式 | `prepare_imagegen_material.py --optimize-boundary`，1024、seam 152、normal 0.54、roughness 132-210 |
| 检查 | boundary=(1,879)，接缝 x=7.01/0.86x、y=8.93/1.16x；2x2 无硬边；活株/成熟株场景与薄叶低光可读性通过 |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable production game texture, PBR base-color albedo. Primary request: an original living salt-crown crop leaf and young stem surface for a premium ocean-survival game, with dense sea-green plant tissue, a fine branching celadon vein network, subtle blue-green wax bloom, sparse pale salt freckles, and restrained warm lime new-growth notes. Subject: continuous botanical epidermis material only, no complete leaf silhouette, plant, flower, fruit, pot, soil, insect, water droplet, or separate object. Style/medium: premium hand-painted stylized realism, crisp controlled material detail, grounded painterly PBR that remains readable on small first-person crop leaves. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, organically varied veins with no dominant center rib, no central focal point, no repeating grid. Lighting: perfectly flat neutral albedo with absolutely no baked directional light, cast shadow, ambient occlusion, reflection, specular highlight, wet gloss, depth of field, or perspective. Color palette: mineral sea green, muted olive, pale celadon, restrained yellow-green and tiny chalk-white salt accents; lively but not neon or monochrome. Constraints: fully original, edge-to-edge material, no text, numbers, symbols, logos, watermark, frame, border, unique scar, branded motif, or resemblance to a specific commercial game. Avoid: photographic leaf scan, tropical houseplant silhouette, giant center vein, plastic foliage, camouflage, mold, moss carpet, checker repetition, material sphere, product mockup, background scene, and dramatic lighting.
```

### TEX-026：盐冠枯叶材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/salt-crown-dry-leaf.webp`、`salt-crown-dry-leaf-normal.webp`、`salt-crown-dry-leaf-roughness.webp` |
| 采用源图 | `artifacts/imagegen/salt-crown-dry-leaf-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` 编辑 |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 枯萎盐冠作物的茎叶表面 |
| 处理方式 | 以 TEX-025 为高保真输入；1024、seam 152、normal 0.66、roughness 190-244、boundary 优化 |
| 检查 | boundary=(1,1)，接缝 x=6.31/0.84x、y=6.75/0.97x；保留同源叶脉尺度；活/熟/枯三状态同屏通过 |

最终提示词：

```text
Use case: precise-object-edit
Asset type: seamless tileable PBR base-color texture for a premium stylized-realistic ocean survival game
Input images: Image 1 is the adopted original living salt-crown crop leaf and young-stem material
Primary request: transform only the plant condition from healthy living tissue to severely dehydrated and salt-withered tissue while preserving Image 1's exact branching vein network, scale, uniform texel density, painterly style, and edge continuity. Replace the green chlorophyll with layered straw ochre, muted olive-brown, pale salt-beige veins, restrained rust-coral stress freckles, and small brittle gray-green remnants. Add fine short dehydration checking between veins and dry curled-color edges inside the tissue, but keep the surface recognizably botanical and related to the living source.
Composition/framing: exact top-down orthographic square continuous material, seamless on all four edges, no central focal point, no complete leaf silhouette, no large unique crack, and no repeating grid
Lighting/mood: flat neutral PBR albedo with absolutely no baked directional light, cast shadow, ambient occlusion, reflection, specular highlight, wet gloss, depth of field, or perspective
Constraints: preserve the vein topology and material scale of Image 1; fully original; no plant object, pot, soil, fruit, insect, text, symbols, logos, watermark, frame, border, branded motif, or resemblance to a specific commercial game
Avoid: autumn leaf collage, tree bark, timber grain, leather, parchment, mud cracks, mold, black rot, photographic scan, material sphere, product mockup, background scene, neon color, and dramatic lighting
```

### TEX-027：盐冠潮果材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/salt-crown-fruit.webp`、`salt-crown-fruit-normal.webp`、`salt-crown-fruit-roughness.webp` |
| 采用源图 | `artifacts/imagegen/salt-crown-fruit-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 成熟作物三枚潮果与播种标记 |
| 处理方式 | 1024、seam 152、normal 0.48、roughness 138-210、boundary 优化 |
| 检查 | boundary=(1,1)，接缝 x=5.76/0.93x、y=5.70/0.85x；2x2 无焦点重复；三枚成熟果缩略尺度可辨 |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable production game texture, PBR base-color albedo. Primary request: an original salt-crown tide-fruit skin surface for a premium ocean-survival game, with a muted chartreuse and sea-glass green waxy rind, fine organic pores, short pale mineral seams, sparse coral-ochre ripening freckles, and tiny salt-cured russet marks. Subject: continuous fruit epidermis material only, no whole fruit silhouette, cut fruit, seed, leaf, stem, plate, pot, food arrangement, or separate object. Style/medium: premium hand-painted stylized realism, appetizing tactile painterly PBR with controlled close-range detail and natural color layering. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on every edge, irregular pore and freckle distribution, no central focal point, radial emblem, or repeating cells. Lighting: perfectly flat neutral albedo with no baked directional light, cast shadow, ambient occlusion, reflection, highlight, wet gloss, depth of field, or perspective. Color palette: muted chartreuse, sea-glass green, pale flax, restrained coral ochre and russet; balanced against teal ocean and warm cedar without fluorescent green. Constraints: fully original edge-to-edge material, no text, numbers, symbols, logos, watermark, frame, border, unique bruise, branded motif, or resemblance to a specific commercial game. Avoid: citrus peel, watermelon stripes, coconut shell, apple skin, mold, slime, plastic toy surface, photographic scan, checker repetition, material sphere, product mockup, and background scene.
```

### TEX-028：盐翼体羽材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/saltwing-body-feather.webp`、`saltwing-body-feather-normal.webp`、`saltwing-body-feather-roughness.webp` |
| 采用源图 | `artifacts/imagegen/saltwing-body-feather-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 盐翼盗鸟躯干、胸羽与头部轮廓羽 |
| 处理方式 | 1024、seam 168、normal 0.46、roughness 176-236、boundary 优化 |
| 检查 | boundary=(820,638)，接缝 x=9.54/0.90x、y=4.84/0.96x；2x2 羽列连续；鸟体近景无鱼鳞/瓦片感 |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable production game texture, PBR base-color albedo. Primary request: original saltwing seabird contour plumage for a premium ocean-survival game, built from small layered body feathers with pale mineral-gray centers, muted sea-glass green shadows, chalk-white salt tips, sparse warm rust-gold flecks, and soft charcoal separation lines. Subject: continuous compact body-plumage material only, no whole bird, wing, tail, head, eye, beak, leg, skeleton, nest, sky, or separate feather object. Style/medium: premium hand-painted stylized realism, tactile painterly PBR with deliberate feather layering and crisp detail for close first-person inspection, not photoreal scanned. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, naturally staggered overlapping contour feathers with varied size and no central focal point or perfect rows. Lighting: perfectly flat neutral albedo with absolutely no baked directional lighting, cast shadow, ambient occlusion, reflection, specular highlight, depth of field, or perspective. Color palette: pale mineral gray, weathered ivory, sea-glass green, cool charcoal, restrained rust-gold accents; airy and readable without monochrome blue or flat white. Constraints: fully original edge-to-edge plumage, no text, numbers, symbols, logos, watermark, frame, border, unique marking, branded motif, or resemblance to a specific commercial game. Avoid: fish scales, fur, shingles, pine cones, owl facial disk, gull photography, cartoon pattern, checker repetition, material sphere, product mockup, background scene, neon color, and dramatic light.
```

### TEX-029：盐翼飞羽材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/saltwing-flight-feather.webp`、`saltwing-flight-feather-normal.webp`、`saltwing-flight-feather-roughness.webp` |
| 采用源图 | `artifacts/imagegen/saltwing-flight-feather-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 双翼十四枚主羽、尾羽和眉羽 |
| 处理方式 | 1024、seam 168、normal 0.58、roughness 174-232、boundary 优化 |
| 检查 | boundary=(1,762)，接缝 x=11.16/0.91x、y=16.64/0.95x；方向羽片无硬边；飞羽与浅色体羽在近景可辨 |

最终提示词：

```text
Use case: stylized-concept. Asset type: seamless tileable production game texture, PBR base-color albedo. Primary request: original saltwing seabird flight-feather vane surface for a premium ocean-survival game, with long fine diagonal barbs, dark weathered teal and graphite layers, pale salt-worn edges woven through the vane, restrained flax-gold notches, and sparse oxidized green accents that distinguish the wings from the body plumage. Subject: continuous flight-feather vane material only, no whole bird, complete feather silhouette, central quill object, wing outline, tail, head, eye, beak, leg, sky, or separate object. Style/medium: premium hand-painted stylized realism, elegant directional painterly PBR with crisp barb structure and controlled weathering, readable during wing animation. Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, long directional barb flow with natural interruptions, no central focal point, emblem, or perfect stripes. Lighting: perfectly flat neutral albedo with absolutely no baked directional light, cast shadow, ambient occlusion, reflection, specular highlight, depth of field, or perspective. Color palette: weathered deep teal, graphite gray, pale celadon salt edge, muted flax gold, tiny oxidized green notes; dark but not navy-black or one-note cyan. Constraints: fully original edge-to-edge material, no text, numbers, symbols, logos, watermark, frame, border, unique insignia, branded motif, or resemblance to a specific commercial game. Avoid: fabric weave, fish scales, fur, wood grain, zebra bands, photographic feather scan, cartoon outline, checker repetition, material sphere, product mockup, background scene, neon blue, and dramatic lighting.
```

### TEX-030：盐翼角质材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/saltwing-keratin.webp`、`saltwing-keratin-normal.webp`、`saltwing-keratin-roughness.webp` |
| 采用源图 | `artifacts/imagegen/saltwing-keratin-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 盐翼盗鸟喙、双腿与六趾 |
| 处理方式 | 1024、seam 144、normal 0.34、roughness 154-218、boundary 优化 |
| 检查 | boundary=(1,1)，接缝 x=7.12/1.07x、y=6.67/0.95x；首版长纤维石纹、同源精修版大理石感均拒绝；采用版保持毫米级低对比角质 |

最终提示词：

```text
Use case: stylized-concept
Asset type: seamless tileable production game texture, PBR base-color albedo
Primary request: an original low-contrast saltwing seabird beak and foot keratin surface for a premium ocean-survival game. The material is mostly smooth muted amber-gray keratin with compact shell-ivory lamellae, very fine short parallel growth lines, tiny charcoal wear specks, faint pale salt abrasion, and sparse old-coral ochre pin marks. Keep ninety percent of the surface calm, coherent, dense, and smooth; all features must be millimeter-scale and suitable for a small beak and thin toes.
Subject: continuous bird keratin material only, no beak silhouette, bird, foot, claw, talon, horn, tooth, bone, shell object, anatomy part, or separate object
Style/medium: premium hand-painted stylized realism, restrained tactile painterly PBR, production-ready and readable at close first-person distance without photographic noise
Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, tiny short marks with no central focal point, broad patch, long stripe, flow, wave, or repeating cells
Lighting: perfectly flat neutral albedo with absolutely no baked directional light, cast shadow, ambient occlusion, reflection, specular highlight, gloss, depth of field, translucency glow, or perspective
Color palette: muted honey amber, warm shell ivory, cool charcoal gray, pale salt and restrained old-coral ochre; warm but desaturated and not orange-dominated
Constraints: fully original edge-to-edge material, no text, numbers, symbols, logos, watermark, frame, border, unique crack, branded motif, or resemblance to a specific commercial game
Avoid: marble, granite, limestone, quartz, tree bark, wood grain, fibers, long striations, leather, reptile scales, polished horn, bright yellow cartoon beak, photographic macro scan, material sphere, product mockup, background scene, dramatic lighting, and high contrast
```

### TEX-031：盐翼虹膜材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/saltwing-eye.webp`、`saltwing-eye-normal.webp`、`saltwing-eye-roughness.webp` |
| 采用源图 | `artifacts/imagegen/saltwing-eye-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 盐翼盗鸟左右圆形虹膜面与翼羽眼缘 |
| 处理方式 | `prepare_imagegen_eye.py`，1024 非平铺中心虹膜、独立 normal/roughness |
| 检查 | pupil=13.1、iris=92.0、edge=15.3；无眼睑/鸟头/烘焙高光；球眼改为有朝向圆面，近景虹膜与喙缘可辨 |

最终提示词：

```text
Use case: stylized-concept. Asset type: production game texture, non-tileable circular eye decal and PBR base-color albedo. Primary request: an original saltwing seabird iris viewed straight-on, with a deep round charcoal pupil, a layered muted amber-green iris, pale celadon radial fibers, sparse rust-gold flecks, and a narrow dark limbal ring; designed for a wary crop-thief seabird in a premium stylized-realistic ocean survival game. Scene/backdrop: texture sheet only, the circular eye centered on a uniform near-black outer field that can be clipped by round geometry. Subject: one centered circular iris and pupil only; no eyelids, feathers, bird head, lashes, blood vessels, tears, animal silhouette, or separate objects. Style/medium: premium hand-painted stylized realism, production-ready PBR albedo with crisp radial detail and controlled painterly variation, readable in close first-person inspection without looking cute or photoreal scanned. Composition/framing: exact top-down orthographic square, pupil exactly centered, iris fills about 82 percent of the canvas, complete circular limbal edge with generous even padding, no perspective and no off-center crop. Lighting: flat neutral base color with no baked directional light, reflection, catchlight, cast shadow, ambient occlusion, wet gloss, depth of field, or three-dimensional eyeball shading. Color palette: charcoal black, mineral amber-green, pale celadon, restrained old-gold rust and tiny cool gray fibers; alert and natural, not neon. Constraints: fully original exact centered circular design; no text, numbers, symbols, logos, watermark, frame, border, recognizable branded motif, or resemblance to a specific commercial game. Avoid: human eye anatomy, cat or reptile slit pupil, giant black featureless sphere, cute cartoon eye, neon cyan, red eye, photographic macro image, glossy baked highlight, material ball, perspective preview, multiple eyes, and background scene.
```

## 本轮 Imagegen 尝试

调用方式：项目 `scripts/imagegen`，运行时读取配置文件 provider 并执行技能内置 CLI，模型固定为 `gpt-image-2`、质量固定为 `high`。本轮先完成盐封打捞手套和 M6 三鱼种/鱼眼，随后以鲜鱼肉为共同尺度锚点编辑熟鱼与焦鱼，并生成耐热折铁、盐蚀聚合物两套生活设备材质；最终又生成盐冠活叶/潮果、盐翼体羽/飞羽/虹膜，以活叶高保真编辑枯叶，并在两次拒绝后重新生成低对比角质。没有切换低阶模型、复用旧纯色材质或以占位冒充完成。所有 M6 新增材质均采用 2048x2048 原创源图、独立 1024 albedo/normal/roughness、既定接缝门禁、2x2 人工复核和真实场景绑定。焦鱼第一版因树皮感拒绝，第二版因缩略图区分不足不采用；角质首版和精修版因长纤维/大理石感不采用。采用源图随仓库归档，仓库没有保存 provider URL 或 API Key。

鲨皮最终请求提示词：

```text
Use case: stylized-concept
Asset type: seamless tileable game texture, PBR base-color albedo
Primary request: an original blue-gray open-ocean shark skin surface for a premium stylized-realistic 3D survival game, with subtle countershading variation, fine directional dermal denticle grain, restrained scars and natural mottling at a scale suitable for a large animal body
Scene/backdrop: texture sheet only
Subject: continuous shark skin material with no body silhouette, fins, eyes, gills, mouth or separate objects
Style/medium: production-ready hand-painted PBR albedo, stylized realism, crisp controlled detail without photographic noise
Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, no central focal point
Lighting/mood: flat neutral albedo with absolutely no baked directional light, cast shadow, ambient occlusion, highlights or perspective
Color palette: cool slate gray, muted blue-green, pale desaturated underside flecks, tiny old scar accents; balanced and not monochrome navy
Constraints: fully original; seamless tile; no text, symbols, logos, watermark, frame, border or recognizable animal anatomy
Avoid: fish scales, reptile scales, fur, leather product presentation, wet gloss, strong contrast, large unique scars, dramatic stripes, material ball, perspective preview, obvious repeating cells
```

编织纤维最终请求提示词：

```text
Use case: stylized-concept
Asset type: seamless tileable game texture, PBR base-color albedo
Primary request: original hand-braided palm fiber and salvaged marine rope weave for a hand-built ocean survival raft, combining narrow dry straw strands, thicker weathered cord and sparse muted coral repair fibers
Scene/backdrop: texture sheet only
Subject: tight practical woven fiber surface with believable irregular tension, frayed microfibers and subtle salt wear; no separate rope coils or objects
Style/medium: production-ready hand-painted PBR albedo, premium stylized realism, tactile readable fibers without photoreal noise
Composition/framing: exact top-down orthographic square texture, uniform texel density, seamless wrapping on all four edges, medium-scale diagonal basket weave with irregular but continuous rhythm
Lighting/mood: flat neutral albedo with absolutely no baked directional light, cast shadow, ambient occlusion, highlights or perspective
Color palette: warm flax, sun-bleached straw, weathered taupe, restrained coral-red repair strands, tiny sea-green faded fibers
Constraints: fully original; seamless tile; no knots larger than the weave, metal, hooks, text, symbols, logos, watermark, frame or border
Avoid: checkerboard perfection, macrame decoration, fabric cloth, wicker furniture presentation, dark brown dominance, glossy plastic rope, large holes, material ball, perspective preview
```

### TEX-032：铁歌漂流阵共鸣青铜材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/iron-choir-resonant-bronze.webp`、`iron-choir-resonant-bronze-normal.webp`、`iron-choir-resonant-bronze-roughness.webp` |
| 采用源图 | `artifacts/imagegen/iron-choir-resonant-bronze-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 铁歌漂流阵五组共鸣腔、摆锤、顶部转子与旧铜镍连接件 |
| 处理方式 | `prepare_imagegen_material.py --size 1024 --seam-width 160 --normal-strength 0.52 --roughness-min 142 --roughness-max 224 --optimize-boundary` |
| 检查 | seam x=`7.46`/`1.10x`、y=`7.40`/`0.93x`，boundary=`(1,1)`；2x2 无十字带/方向性高光，铁歌近景旧金/冷镍层可辨 |

采用提示词：

```text
Create one original seamless tileable game-material albedo: resonant marine copper-nickel bronze used on a wind-driven open-ocean signal array. Show only one continuous flat material surface, viewed exactly top-down and orthographic, filling the entire square. The surface is premium hand-painted stylized realism with broad muted old-gold and cool nickel variation, shallow hand-planished hammer facets, very fine acoustic stress freckles, sparse mineral-teal patina only in micro-recesses, restrained chalk-white salt bloom, and a few charcoal damping traces. Keep the metal dense, maintained, and readable both close up and at distance. Use uniform texel density and irregular non-directional detail so all four edges wrap seamlessly. Flat neutral base color only: no directional light, reflection, specular highlight, cast shadow, ambient occlusion, depth, glow, or perspective. Do not depict any bell, chime, instrument, plate edge, rivet layout, wire, machinery, tower, ocean, separate object, center emblem, circles, stripes, repeating cells, text, symbols, logos, watermark, frame, polished brass, orange rust, large corrosion holes, thick verdigris, photographic scan, material sphere, or product mockup.
```

首轮有器物轮廓/方向性高光的候选拒绝；采用版只保留连续材料表面。源图、运行时三图和 `iron-choir` 近景证据均归档。

### TEX-033：风针观测标电气陶瓷材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/storm-needle-electret-ceramic.webp`、`storm-needle-electret-ceramic-normal.webp`、`storm-needle-electret-ceramic-roughness.webp` |
| 采用源图 | `artifacts/imagegen/storm-needle-electret-ceramic-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high` |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 风针观测标传感器绝缘环、取样器、顶端电气陶瓷与微型仪器罩 |
| 处理方式 | `prepare_imagegen_material.py --size 1024 --seam-width 168 --normal-strength 0.32 --roughness-min 170 --roughness-max 232 --optimize-boundary` |
| 检查 | seam x=`3.05`/`1.06x`、y=`2.63`/`0.92x`，boundary=`(1,1023)`；2x2 为连续哑光瓷釉，无 terrazzo/混凝土/石屑，风针近景与青铜/信号层压板层次清晰 |

采用提示词：

```text
Create an original seamless PBR albedo texture for a matte salt-fired porcelain enamel coating used on precision storm instruments at sea. Fill the square with one continuous smooth dense coating, exactly top-down and orthographic. Use a pale smoke-ivory base, soft cool-slate cloudy brush variation, tiny desaturated celadon ion marks, a few muted coral mineral pinpoints, faint graphite dust, and delicate chalk-white salt frosting. The finish is premium hand-painted stylized realism: calm broad color structure with crisp microscopic wear, non-directional, uniform texel density, and tileable on all four edges. It must look like engineered matte porcelain enamel, not rock. Flat base color with no baked lighting, highlight, reflection, shadow, ambient occlusion, glow, depth, or perspective. No aggregate, pebbles, stone chips, terrazzo, concrete, marble, granite, cracks, tiles, panel seams, objects, instruments, lightning, ocean, text, symbols, logos, border, material sphere, or product mockup.
```

首轮 terrazzo/混凝土感候选与连接失败重试均未进入运行时；采用版经过 2x2、地图相关性和风针目的地近景复核。

### TEX-034：潮缚索具材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/tidebound-rigging.webp`、`tidebound-rigging-normal.webp`、`tidebound-rigging-roughness.webp` |
| 采用源图 | `artifacts/imagegen/tidebound-rigging-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high`，项目 `scripts/imagegen` CLI |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 打捞钩扎结、网具绳床、浮包绑绳、筏面索具、工具与设备绑扎 |
| 处理方式 | `prepare_imagegen_material.py --size 1024 --seam-width 160 --normal-strength 0.68 --roughness-min 184 --roughness-max 246 --optimize-boundary` |
| 检查 | seam x=`13.52`/`1.00x`、y=`13.73`/`1.02x`，boundary=`(1,1)`；2x2 无硬缝/十字带，珊瑚修补线和矿物青痕保持稀疏 |

采用提示词：

```text
Use case: stylized-concept
Asset type: seamless tileable production PBR base-color albedo for first-person tools, hook line details, salvage bundles, raft rigging and collection-net ties in an original ocean survival game.
Primary request: an original tidebound marine rigging surface made from tightly laid weathered hemp strands, darker tar-waxed cord, pale salt-crusted fibers, sparse muted coral repair thread, subtle sea-glass green mineral staining and a few frayed microfibers held under believable tension.
Scene/backdrop: texture sheet only.
Subject: continuous practical braided rope and cord material only, with an irregular diagonal lay that reads at close first-person scale but remains calm at distance.
Style/medium: premium hand-painted stylized realism, tactile production-ready PBR albedo with controlled fiber detail, physically plausible weathering, no photographic scan noise.
Composition/framing: exact orthographic top-down square, uniform texel density, edge-to-edge coverage, seamless wrapping on all four edges, no central rope coil, knot, buckle, splice, object silhouette or repeated emblem.
Lighting/mood: perfectly flat neutral base color with absolutely no baked directional lighting, cast shadow, ambient occlusion, highlight, reflection, wet gloss, depth of field or perspective.
Color palette: weathered flax, charcoal tar, pale salt gray, restrained coral repair fibers and sparse mineral teal; balanced against warm cedar and deep ocean without becoming monochrome brown or blue.
Constraints: fully original; no text, letters, numbers, logos, watermark, border, frame, tools, hands, hooks, nets, boats, animals, horizon, background scene, recognizable branded pattern or resemblance to any named commercial game.
Avoid: rope coil, macrame wall hanging, basket weave, knitted wool, clean new nylon, fishing net grid, large knots, dramatic fraying, thick stripes, leather, fabric canvas, checker repetition, material ball, product mockup, perspective preview, dark vignette or hard directional shadow.
```

### TEX-035：盐蚀工具钢材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/brineworn-tool-steel.webp`、`brineworn-tool-steel-normal.webp`、`brineworn-tool-steel-roughness.webp` |
| 采用源图 | `artifacts/imagegen/brineworn-tool-steel-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high`，项目 `scripts/imagegen` CLI |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 第一人称钩、锤、矛、斧、钓具金属，补给箱/桶箍、网具卡扣与通用打捞五金 |
| 处理方式 | `prepare_imagegen_material.py --size 1024 --seam-width 152 --normal-strength 0.56 --roughness-min 112 --roughness-max 194 --optimize-boundary` |
| 检查 | seam x=`7.29`/`1.08x`、y=`10.22`/`1.00x`，boundary=`(1,1)`；2x2 无硬缝，运行时以两档 PBR 参数区分维护钢与锈蚀五金，未复制烹饪折铁 |

采用提示词：

```text
Use case: stylized-concept
Asset type: seamless tileable production PBR base-color albedo for first-person salvage tools, hook hardware, spear points, axe heads, hammer caps, metal brackets and recovered ocean debris in an original survival game.
Primary request: an original brineworn marine tool-steel surface with fine hand-forged planishing, restrained graphite-blue mill oxide, small salt pits, pale nickel edge scuffs, sparse muted red-brown oxidation freckles and a few cool mineral teal corrosion traces, maintained enough to remain mechanically sound.
Scene/backdrop: texture sheet only.
Subject: continuous forged salvage steel material only, without a complete blade, hook, nail, rivet, bolt, plate, seam or manufactured object silhouette.
Style/medium: premium hand-painted stylized realism, close-range production-ready PBR albedo with tactile controlled microdetail and physically plausible metal wear, not photographic scan noise.
Composition/framing: exact orthographic top-down square, uniform texel density, edge-to-edge material coverage, seamless wrapping on all four sides, no central focal mark, no directional long band and no repeated hardware layout.
Lighting/mood: perfectly flat neutral base color with absolutely no baked directional light, cast shadows, ambient occlusion, reflection, specular highlight, wet gloss, depth of field or perspective.
Color palette: cool gunmetal, charcoal graphite, restrained old nickel, tiny oxide red-brown and sparse mineral teal; dark but readable, balanced against cedar and sea-glass surfaces without a one-note blue, brown or black palette.
Constraints: fully original; no text, letters, numbers, symbols, logo, watermark, border, frame, tools, hands, weapons, hooks, grills, cookware, machinery, ship parts, animals, horizon, background scene, recognizable branded pattern or resemblance to any named commercial game.
Avoid: polished chrome, mirror reflection, diamond plate, corrugated steel, brushed stainless bands, heavy orange rust, orange-brown dominance, large cracks, holes, sparks, flame soot, fantasy runes, rivet grid, checker repetition, material ball, product mockup, perspective preview, dark vignette or dramatic lighting.
```

两套源图均由项目配置 provider 直接生成，仓库不含 URL 或密钥。`salvage-pickup-canvas.png` 使用 WebGL framebuffer 直读规避 X11 空合成层，证明雪松/深木、索具、工具钢、聚合物、手套与真实回收包在同一运行场景绑定；工具钢乘色经该场景校准，未修改源图或降低贴图规格。

### TEX-036：风暴冲刷岛岩材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/stormwashed-island-stone.webp`、`stormwashed-island-stone-normal.webp`、`stormwashed-island-stone-roughness.webp` |
| 采用源图 | `artifacts/imagegen/stormwashed-island-stone-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high`，项目 `scripts/imagegen` CLI |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 盐冠浅滩地标岩、岸上潮磨石堆、石斧与石质锚爪 |
| 处理方式 | `prepare_imagegen_material.py --size 1024 --seam-width 160 --normal-strength 0.62 --roughness-min 176 --roughness-max 238 --optimize-boundary` |
| 检查 | seam x=`9.38`/`0.96x`、y=`12.74`/`0.88x`，boundary=`(1,1)`；2x2 无硬缝，暖灰/橄榄矿层与小型盐粒在低多边形岩体上可辨 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: storm-washed island limestone and volcanic beach stone. Orthographic straight-on material scan, the surface fills the entire frame, no object silhouette and no perspective. Layered warm gray, muted olive, and cool charcoal mineral planes with small pale salt inclusions, fine erosion pits, narrow mineral seams, and a few restrained rust-brown flecks. Hand-authored semi-realistic painterly PBR art direction with crisp medium-frequency facets that remain readable on low-poly boulders, but no cartoon outlines and no photoreal camera noise. Even diffuse neutral lighting, essentially shadowless, no baked directional highlight, no ambient occlusion vignette. Uniform detail density across all four edges, visually seamless in both axes, no border, no centered feature, no cracks forming a single large focal shape. No sand, moss, plants, shells, water, props, text, symbols, logos, or watermark. This is an albedo source only: do not depict a normal map, roughness map, UV checker, texture sheet, or material sphere.
```

### TEX-037：盐冠棕榈树皮材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/saltcrown-palm-bark.webp`、`saltcrown-palm-bark-normal.webp`、`saltcrown-palm-bark-roughness.webp` |
| 采用源图 | `artifacts/imagegen/saltcrown-palm-bark-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high`，项目 `scripts/imagegen` CLI |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 远景与可探索棕榈树干、四段采集树干和砍伐后树桩 |
| 处理方式 | `prepare_imagegen_material.py --size 1024 --seam-width 176 --normal-strength 0.66 --roughness-min 184 --roughness-max 242 --optimize-boundary` |
| 检查 | seam x=`20.48`/`0.97x`、y=`10.97`/`1.03x`，boundary=`(1,1)`；横向节理为连续生长带而非处理接缝，纵纤维与筏板雪松明确分离 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: weathered salt-crown palm trunk bark. Orthographic straight-on material scan, bark surface filling the complete frame, no trunk silhouette, no perspective. Dense narrow vertical fibers and shallow broken horizontal growth bands, dark umber and smoked brown underlayers, sun-bleached ochre ridges, subtle desaturated green-gray salt staining, and tiny pale salt deposits embedded between fibers. The identity must be clearly tropical palm bark and distinct from sawn raft planks or generic tree bark. Hand-authored semi-realistic painterly PBR art direction, tactile at close range but calm enough for repeated trunks; no cartoon outline, no photoreal camera grain. Even diffuse neutral lighting, shadowless, no baked highlight or deep black crevice. Uniform detail density to every edge, visually seamless in both axes, no border, no central knot, no cut ends or rings, no large scars. No leaves, rope, wood boards, nails, beach, water, props, text, symbols, logos, or watermark. Albedo source only: do not depict a normal map, roughness map, UV grid, material ball, or atlas.
```

### TEX-038：盐冠棕榈叶面材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/saltcrown-palm-frond.webp`、`saltcrown-palm-frond-normal.webp`、`saltcrown-palm-frond-roughness.webp` |
| 采用源图 | `artifacts/imagegen/saltcrown-palm-frond-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high`，项目 `scripts/imagegen` CLI |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 棕榈叶片、岛上灌木、纤维簇与海面棕榈纤维漂流物 |
| 处理方式 | `prepare_imagegen_material.py --size 1024 --seam-width 168 --normal-strength 0.52 --roughness-min 148 --roughness-max 220 --optimize-boundary` |
| 检查 | seam x=`8.16`/`1.09x`、y=`17.91`/`0.91x`，boundary=`(1,1023)`；细胞纤维、浅色叶脉和干纤维在 2x2 与岛屿 framebuffer 中连续 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: close surface of living salt-crown palm frond tissue used on leaves, shrubs, and harvestable fibers. Orthographic flat material scan with the leaf tissue filling the complete frame; no whole leaf silhouette and no perspective. Interwoven fine longitudinal cellulose fibers, several soft parallel veins, deep ocean green and muted bottle green planes, pale sage ridges, restrained sun-yellow edge wear, tiny salt-white specks, and occasional dry fiber strands. It must read as living fibrous palm material at thumbnail scale while staying natural and not neon. Hand-authored semi-realistic painterly PBR art direction with controlled medium and fine detail, no cartoon outline and no photoreal camera grain. Even diffuse neutral lighting, shadowless, no glossy hotspot, no transparent background. Uniform detail density across every edge, visually seamless in both axes, no border, no centered vein or large focal feature. No whole plant, branch, fruit, insects, water, props, text, symbols, logos, or watermark. Albedo source only: no normal map, roughness map, UV grid, texture sheet, material sphere, or presentation mockup.
```

### TEX-039：野生潮果果皮材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/tidefruit-skin.webp`、`tidefruit-skin-normal.webp`、`tidefruit-skin-roughness.webp` |
| 采用源图 | `artifacts/imagegen/tidefruit-skin-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high`，项目 `scripts/imagegen` CLI |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 棕榈冠层潮果与落地潮果采集节点；不复用 M6 作物盆盐冠果皮 |
| 处理方式 | `prepare_imagegen_material.py --size 1024 --seam-width 160 --normal-strength 0.42 --roughness-min 116 --roughness-max 188 --optimize-boundary` |
| 检查 | seam x=`11.43`/`1.09x`、y=`9.29`/`0.90x`，boundary=`(1,1)`；橙红成熟色、细毛孔和纵向生长纹在冠层缩略尺度可辨，无鱼肉/皮革/锈铁语义 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: edible wild tidefruit skin from a salt-crown island palm. Orthographic macro material scan, fruit skin filling the entire frame, no whole fruit silhouette and no perspective. A distinctive mature palette of muted coral-russet and weathered amber over olive-brown undertones, fine pebbled pores, faint irregular longitudinal growth striations, tiny pale salt bloom, and restrained darker ripening freckles. It should look juicy and edible yet rugged from sea air, clearly different from crop fruit and from leather, stone, or rusted metal. Hand-authored semi-realistic painterly PBR art direction, polished game asset with controlled microdetail, no cartoon outlines and no photoreal camera grain. Even diffuse neutral lighting, shadowless, no baked specular hotspot, no deep vignette. Uniform detail density to every edge, visually seamless in both axes, no border, no centered blemish or single large focal mark. No stem, leaves, cut fruit, pulp, basket, beach, water, props, text, symbols, logos, or watermark. Albedo source only: do not depict a normal map, roughness map, UV checker, texture atlas, material sphere, or presentation board.
```

### TEX-040：盐冠岸滩地表材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/saltcrown-shore-ground-packed.webp`（RGB albedo + A roughness）、`saltcrown-shore-ground-normal.webp`；审计中间图为 `artifacts/imagegen/saltcrown-shore-ground-albedo-1024.webp` 与 `saltcrown-shore-ground-roughness-1024.webp` |
| 采用源图 | `artifacts/imagegen/saltcrown-shore-ground-raw.png` |
| 模型 / 质量 | `gpt-image-2` / `high`，项目 `scripts/imagegen` CLI |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 可探索岛高度场、远景沙洲；顶点色继续表达沙地、旱草、绿地、岩区和浸水带的大尺度分层 |
| 处理方式 | `prepare_imagegen_material.py --size 1024 --seam-width 168 --normal-strength 0.54 --roughness-min 184 --roughness-max 242 --optimize-boundary`，再由 `pack_roughness_alpha.py --quality 92` 精确写入 alpha |
| 检查 | seam x=`18.08`/`1.14x`、y=`19.56`/`1.15x`，boundary=`(1,1)`；packed alpha 与原 roughness 像素差为空；岛屿帧由 33 降至硬预算 `32/32`，未删除 PBR 信息 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: neutral salt-crown island shore ground used beneath vertex-color tinting. Orthographic straight-down material scan with the ground surface filling the entire frame, no landscape horizon and no perspective. Fine compact pale mineral sand mixed with tiny weathered shell grains, short dry cellulose fragments, sparse muted olive mineral flecks, subtle gray clay dust, and restrained charcoal grit. Keep the overall albedo near neutral light warm gray-beige so game vertex colors can tint it into beach sand, dry grass, green upland, and stony soil without muddying. Hand-authored semi-realistic painterly PBR art direction, crisp millimeter-scale grain readable close up but calm at distance; no cartoon outline and no photoreal camera noise. Even diffuse neutral lighting, shadowless, no footprints, no ripples forming directional bands, no wet glossy area, no ambient occlusion vignette. Uniform detail density across every edge, visually seamless in both axes, no border, no centered shell or large focal feature. No plants, whole shells, rocks, water, props, text, symbols, logos, or watermark. Albedo source only: do not depict a normal map, roughness map, UV grid, texture sheet, material sphere, or presentation mockup.
```

五套源图都由同一项目配置 provider 以 `gpt-image-2 high 2048x2048` 生成。`island-materials-canvas.png` 使用 WebGL framebuffer 直读，证明地表、岩石、树皮、叶片、纤维和潮果在真实岛屿同帧可辨；运行时 15 个材质槽全部有绑定，其中岸滩 albedo/roughness 共用一张无损通道打包纹理，场景维持 `32` 张纹理上限。

### TEX-041：浸水盐冠礁岩材质组

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/saltcrown-underwater-pbr-atlas.webp`（礁岩区域 RGB albedo + A roughness）、`saltcrown-underwater-pbr-normal-atlas.webp`（对应 normal 区域） |
| 采用源图 | `artifacts/imagegen/brine-reef-rock-raw.png` |
| 审计 PBR | `artifacts/imagegen/underwater-pbr/brine-reef-rock.webp`、`brine-reef-rock-normal.webp`、`brine-reef-rock-roughness.webp` |
| 模型 / 质量 | `gpt-image-2` / `high`，项目 `scripts/imagegen` CLI |
| 请求 / 实际尺寸 | `2048x2048` / `2048x2048` |
| 用途 | 盐冠浅礁 44 个礁岩实例、海草固着石和矿点基岩；与岸上岛岩保持不同水蚀语义 |
| 处理方式 | 1024、seam 176、normal 0.62、roughness 176-238、boundary 优化；图集核心 960 + 32 gutter |
| 检查 | seam x=`15.26/1.01x`、y=`14.63/0.93x`，boundary=`(1,1)`；冷色矿层、侵蚀孔和藻痕在低多边形礁岩上可辨 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: permanently submerged salt-crown reef rock. Orthographic straight-on material scan, continuous stone surface filling the frame, no rock silhouette and no perspective. Layered cool blue-gray and muted green-gray mineral planes, rounded saltwater erosion pits, narrow chalky calcite seams, sparse dark volcanic grains, delicate teal algae staining inside recesses, and tiny pale shell-mineral inclusions. It must read as water-worn reef substrate and remain distinct from dry island stone. Hand-authored semi-realistic painterly PBR art direction with crisp medium-frequency structure readable on low-poly rocks, no cartoon outlines and no photographic noise. Flat neutral diffuse lighting, no baked caustic, directional highlight, cast shadow, deep vignette, or wet reflection. Uniform detail density on all four edges, seamless in both axes, no border, no large central crack or focal boulder. No coral, plants, fish, sand, open water, bubbles, props, text, symbols, logos, or watermark. Albedo source only: no normal map, roughness map, UV grid, material sphere, atlas, or preview.
```

### TEX-042：暖枝珊瑚材质组

| 字段 | 内容 |
| --- | --- |
| 运行时 / 审计 | 双图集 `ember-branch-coral` 区域；独立审计图位于 `artifacts/imagegen/underwater-pbr/ember-branch-coral*.webp` |
| 采用源图 | `artifacts/imagegen/ember-branch-coral-raw.png` |
| 模型 / 质量 / 尺寸 | `gpt-image-2` / `high` / `2048x2048` |
| 用途 | 暖红珊瑚枝体与芽体实例 |
| 处理方式 | 1024、seam 168、normal 0.52、roughness 156-220、boundary 优化；图集核心 960 + 32 gutter |
| 检查 | seam x=`17.79/1.07x`、y=`17.67/0.93x`，boundary=`(1,1)`；细小 corallite 孔与红色 calcite 不退化为黏土或肉质 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: living warm branch-coral calcite surface. Orthographic macro material scan, continuous coral tissue and mineral skin filling the complete frame, no whole coral colony silhouette and no perspective. Muted coral-red, ember rose, and weathered terracotta planes over pale calcite, thousands of tiny irregular star-shaped corallite pores, fine branching growth striations, restrained cream tips, and sparse cool mineral specks. Healthy but salt-worn, organic and porous rather than clay, meat, or painted stone. Hand-authored semi-realistic painterly PBR art direction, controlled microdetail readable on narrow low-poly branches, no cartoon outline and no photoreal camera grain. Even diffuse neutral lighting, shadowless, no baked caustic, glossy hotspot, translucency glow, ambient occlusion vignette, or wet reflection. Uniform detail density across all edges, seamless in both axes, no border, central flower, large polyp, or repeating rosette grid. No whole coral, fish, seaweed, rock, ocean scene, props, text, symbols, logos, or watermark. Albedo source only: no normal map, roughness map, UV checker, texture atlas, material sphere, or mockup.
```

### TEX-043：浅色潮冠珊瑚材质组

| 字段 | 内容 |
| --- | --- |
| 运行时 / 审计 | 双图集 `tidecrown-pale-coral` 区域；独立审计图位于 `artifacts/imagegen/underwater-pbr/tidecrown-pale-coral*.webp` |
| 采用源图 | `artifacts/imagegen/tidecrown-pale-coral-raw.png` |
| 模型 / 质量 / 尺寸 | `gpt-image-2` / `high` / `2048x2048` |
| 用途 | 浅色珊瑚枝体与芽体实例，与暖枝珊瑚形成物种区分 |
| 处理方式 | 1024、seam 168、normal 0.54、roughness 166-228、boundary 优化；图集核心 960 + 32 gutter |
| 检查 | seam x=`13.27/0.92x`、y=`13.77/0.94x`，boundary=`(1,1)`；骨白、烟灰绿与细小孔隙无陶瓷/砂岩感 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: pale tide-crown branch-coral calcite surface, a distinct species from warm red coral. Orthographic macro material scan, continuous living coral surface filling the frame, no colony silhouette and no perspective. Soft bone ivory, faded straw, smoke-sage, and very pale sea-glass green variation, dense tiny irregular corallite cups, delicate fan-like mineral growth lines, restrained chalk-white ridges, and sparse muted lavender-gray specks. Alive and mineral-rich, not bleached dead coral, ceramic, sandstone, concrete, or skin. Hand-authored semi-realistic painterly PBR art direction with calm broad color and crisp microstructure readable on small buds and branches, no cartoon outline and no photographic noise. Flat neutral diffuse lighting, no baked caustic, cast shadow, glossy highlight, subsurface glow, ambient-occlusion vignette, or wet reflection. Uniform edge-to-edge detail, seamless in both axes, no border, central flower, large polyp, or repeating cellular grid. No whole coral, fish, plant, rock, ocean, props, text, symbols, logos, or watermark. Albedo source only: no normal map, roughness map, UV grid, atlas, material sphere, or presentation board.
```

### TEX-044：长叶海草组织材质组

| 字段 | 内容 |
| --- | --- |
| 运行时 / 审计 | 双图集 `long-ribbon-seaweed` 区域；独立审计图位于 `artifacts/imagegen/underwater-pbr/long-ribbon-seaweed*.webp` |
| 采用源图 | `artifacts/imagegen/long-ribbon-seaweed-raw.png` |
| 模型 / 质量 / 尺寸 | `gpt-image-2` / `high` / `2048x2048` |
| 用途 | 34 个环境海草实例与可收割长叶海草节点 |
| 处理方式 | 1024、seam 168、normal 0.46、roughness 136-208、boundary 优化；图集核心 960 + 32 gutter |
| 检查 | seam x=`13.96/1.01x`、y=`9.61/1.01x`，boundary=`(1,1)`；首版因整叶重叠/阴影/空隙拒绝，采用版只含连续单层组织和纵向细纤维 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: the microscopic flat skin of living long-ribbon seaweed. Show exactly one continuous single-layer tissue surface covering the complete square, like a flat material swatch viewed orthographically; absolutely no separate blades, ribbons, leaf edges, overlaps, folds, gaps, silhouettes, depth, or perspective. Use deep kelp green, muted bottle green, cool teal-green and pale olive micro-variation, thousands of very fine parallel cellulose fibers, many thin broken longitudinal veins, tiny salt pores expressed only through color, restrained amber fiber wear, and sparse pale mineral freckles. Keep all features small, shallow, evenly distributed, and readable as flexible underwater plant tissue rather than palm leaf, fabric, rope, grass, or painted plastic. Premium hand-authored semi-realistic painterly PBR art direction with controlled microdetail, no cartoon outlines and no photographic grain. Perfectly flat neutral diffuse albedo: no directional lighting, cast shadow, ambient occlusion, caustic, glossy hotspot, wet reflection, translucency glow, vignette, or transparent background. Uniform detail density at every edge, seamless in both axes, no border, central vein, tear, or focal mark. No whole plant, leaf, frond, fish, coral, bubbles, water scene, props, text, symbols, logos, or watermark. Albedo source only: no normal map, roughness map, UV grid, atlas, material sphere, or preview.
```

### TEX-045：盐壳金属矿材质组

| 字段 | 内容 |
| --- | --- |
| 运行时 / 审计 | 双图集 `saltcrust-metal-ore` 区域；独立审计图位于 `artifacts/imagegen/underwater-pbr/saltcrust-metal-ore*.webp` |
| 采用源图 | `artifacts/imagegen/saltcrust-metal-ore-raw.png` |
| 模型 / 质量 / 尺寸 | `gpt-image-2` / `high` / `2048x2048` |
| 用途 | 盐壳金属矿晶体、回潮熔炉待加工矿样 |
| 处理方式 | 1024、seam 168、normal 0.68、roughness 118-210、boundary 优化；图集核心 960 + 32 gutter |
| 检查 | seam x=`12.82/1.02x`、y=`13.56/0.92x`，boundary=`(1,1)`；磁铁矿/含铜矿层与工具钢、岛岩和珠宝语义分离 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: salt-crusted marine metal ore embedded in reef mineral. Orthographic straight-on material scan, continuous raw ore surface filling the frame, no ore chunk silhouette and no perspective. Dense charcoal magnetite and muted blue-green copper-bearing mineral planes, small dull nickel crystals, narrow oxidized teal seams, pale salt crust in recesses, sparse rusty red-brown freckles, and rough gray host stone. It must read as valuable unrefined mineral, clearly different from forged tool steel, polished metal, dry island rock, or turquoise jewelry. Hand-authored semi-realistic painterly PBR art direction with crisp faceted inclusions readable on small crystals, no cartoon outlines and no photographic scan noise. Flat neutral diffuse lighting, no baked reflection, specular highlight, cast shadow, glow, sparks, deep vignette, or wet surface. Uniform detail density on all edges, seamless in both axes, no border, central geode, large vein, manufactured plate, or repeated crystal cluster. No tools, coins, machinery, coral, plants, water, props, text, runes, logos, or watermark. Albedo source only: no normal map, roughness map, metallic map, UV grid, material sphere, atlas, or mockup.
```

### TEX-046：潮红礁泥材质组

| 字段 | 内容 |
| --- | --- |
| 运行时 / 审计 | 双图集 `tide-red-reef-clay` 区域；独立审计图位于 `artifacts/imagegen/underwater-pbr/tide-red-reef-clay*.webp` |
| 采用源图 | `artifacts/imagegen/tide-red-reef-clay-raw.png` |
| 模型 / 质量 / 尺寸 | `gpt-image-2` / `high` / `2048x2048` |
| 用途 | 潮红黏土采集节点 |
| 处理方式 | 1024、seam 168、normal 0.52、roughness 184-242、boundary 优化；图集核心 960 + 32 gutter |
| 检查 | seam x=`8.14/1.11x`、y=`8.54/0.93x`，boundary=`(1,1)`；压实粉砂与水浸深斑保持哑光，不像熟陶、肉、皮革或锈钢 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: compact wet tide-red clay from a shallow reef shelf. Orthographic top-down material scan, continuous clay surface filling the frame, no lump silhouette and no perspective. Muted brick red, iron rose, umber, and smoky mauve layers with fine compressed silt, shallow thumb-sized natural shear lines, tiny pale shell dust, sparse gray mineral grains, and subtle darker waterlogged patches expressed without gloss. It must read as raw cohesive clay, not cooked terracotta, meat, leather, rusted steel, or desert soil. Hand-authored semi-realistic painterly PBR art direction, tactile and readable on small harvest lumps but calm enough to tile, no cartoon outline and no photoreal camera grain. Even diffuse neutral lighting, shadowless, no baked caustic, shiny wet hotspot, deep crack, cast shadow, or vignette. Uniform edge-to-edge detail, seamless in both axes, no border, central footprint, pottery mark, large stone, or single focal feature. No plants, coral, water scene, tools, props, text, symbols, logos, or watermark. Albedo source only: no normal map, roughness map, UV checker, material ball, atlas, or presentation mockup.
```

### TEX-047：盐冠礁鱼皮材质组

| 字段 | 内容 |
| --- | --- |
| 运行时 / 审计 | 双图集 `saltcrown-reef-fish-skin` 区域；独立审计图位于 `artifacts/imagegen/underwater-pbr/saltcrown-reef-fish-skin*.webp` |
| 采用源图 | `artifacts/imagegen/saltcrown-reef-fish-skin-raw.png` |
| 模型 / 质量 / 尺寸 | `gpt-image-2` / `high` / `2048x2048` |
| 用途 | 三组小型巡游礁鱼的躯体与尾鳍 |
| 处理方式 | 1024、seam 160、normal 0.42、roughness 112-188、boundary 优化；图集核心 960 + 32 gutter |
| 检查 | seam x=`10.97/0.99x`、y=`9.10/0.88x`，boundary=`(1,277)`；小尺度青银鳞与三种可钓鱼、金属和爬行皮分离 |

采用提示词：

```text
Create an original square tileable base-color material texture for a premium stylized 3D ocean-survival game: skin surface of a small schooling salt-crown reef fish. Orthographic macro material scan, continuous fish skin filling the entire frame, no whole fish silhouette and no perspective. Tight tiny overlapping scales with a muted sea-glass teal and silver-gray base, soft pale aqua lateral shimmer bands, sparse warm sand-gold scale tips, restrained charcoal speckles, and a few subtle coral-red flecks. The surface should look agile, alive, and underwater-readable while remaining distinct from the three catchable fish species and from metal or reptile skin. Hand-authored semi-realistic painterly PBR art direction with controlled scale rhythm suitable for very small low-poly bodies, no cartoon outlines and no photoreal camera noise. Flat neutral diffuse lighting, no baked specular streak, caustic, reflection, shadow, iridescent rainbow, vignette, or wet gloss. Uniform detail density to every edge, seamless in both axes, no border, eye, fin, gill, lateral-line focal stripe, or large unique mark. No whole animal, ocean scene, coral, plants, bubbles, props, text, symbols, logos, or watermark. Albedo source only: no normal map, roughness map, UV grid, texture atlas, material sphere, or mockup.
```

七套审计 PBR 经 `scripts/build_pbr_atlas.py` 形成 4096x2048 双图集：每格 1024，核心 960，四周 32 像素周期 gutter；RGB albedo + A roughness 的 alpha 保存后逐像素一致，normal 独立。`underwater-materials-canvas.png` 与真实收割流程证明七个区域的 21 个 PBR 槽均绑定，运行时保持 `32/32` 纹理预算；海草首版因整叶轮廓和阴影拒绝，未进入归档或运行时。

## 代码原生模型与动画

本轮新增鲨体分段伤痕、海面聚焦环和鲨鱼战利品捆扎浮包，继续由代码原生形体驱动；鲨皮沿用独立 TEX-003 PBR，肉、皮、齿、绳结和浮托按材质与轮廓分层。采集段、对象池、耐久与 v18 存档均不依赖视觉对象作为玩法真值；没有因本机软件 WebGL 复验失败而降低运行时贴图质量。

| ID | 资产 | 位置 | 当前状态 |
| --- | --- | --- | --- |
| MOD-001 | 可扩展木筏：每格 3 木板、2 横梁、4 铆钉 | `src/game/systems/RaftSystem.ts` | 动态实例化，支持逐格损伤、修补和拆除 |
| MOD-002 | 打捞钩：木柄、弯钩、尖端、五圈绳缠 | `src/game/art/ProceduralModels.ts` | 已用于第一视角与投射物 |
| MOD-003 | 木料、聚合容器、纤维叶、盐封补给箱与三道金属箍补给桶 | `src/game/art/ProceduralModels.ts` | 五类形体已进入固定种子漂流物对象池，箱桶拥有独立战利品层级 |
| MOD-004 | 远景岛原型：岩体、沙洲、树干和 42 片叶 | `src/game/art/ProceduralModels.ts` | 保留为历史原型，运行时已由可探索岛替代 |
| MOD-005 | 建造锤：木柄、金属锤头、撞面、拔钉爪、六圈绑带 | `src/game/art/ProceduralModels.ts` | 已进入第一视角建造与修补 |
| MOD-006 | 木矛：长杆、金属尖端与五圈扎结 | `src/game/art/ProceduralModels.ts` | 已进入第一视角刺击 |
| MOD-007 | 钓竿、卷线轮、浮标，以及银脊鱼、旗尾梭、琥鳍鲷三种鱼体 | `src/game/art/ProceduralModels.ts` | 三种鱼使用平滑躯体、独立背/胸/尾鳍轮廓、Image 2 鱼皮与虹膜 PBR；体型缩放、挣扎、捕获展示和单实例显隐进入完整循环 |
| MOD-008 | 深潮鲨：车削躯干、背鳍、胸鳍、尾柄、双叶尾、眼、口、鳃与三段采集伤痕 | `src/game/art/ProceduralModels.ts` | 15+ 独立网格，已接巡游、袭击、受击、侧翻浮尸与采集阶段 |
| MOD-009 | 潮汐净水器：绑扎木架、火盆、海水槽、编织蒸馏罩、冷凝沟、滴管与透明杯具 | `src/game/art/ProceduralModels.ts` | 35+ 独立网格，运行阶段驱动海水/净水水位和滴水 |
| MOD-010 | 折铁烤架：绑扎木架、折铁火盆、九根炉条、横撑、把手与鱼段 | `src/game/art/ProceduralModels.ts` | 40+ 独立网格；折铁/雪松/编织纤维与生/熟/焦鱼肉均使用审定 PBR，平放姿态、真实收取和基础设备近景通过 |
| MOD-011 | 盐冠浅滩：2115 顶点高度场、PBR 微表面/顶点色分层、5 个岩石地标、22 个灌木和 30 条岸浪 | `src/game/art/ProceduralModels.ts` | TEX-036/TEX-038/TEX-040 已接入接近、靠岸、登岛、离流和重生周期；实例化与 32 纹理预算保持 |
| MOD-012 | 岛屿资源组：4 棕榈、枝料、石堆、潮果、纤维簇与交互高亮 | `src/game/art/ProceduralModels.ts` | TEX-036-TEX-039 独立绑定；节点内部实例化，支持生命、拾取、倒伏和树桩 |
| MOD-013 | 潮磨石斧：回收木柄、石质斧头、金属刃口和六圈编织绑带 | `src/game/art/ProceduralModels.ts` | 已进入第一视角挥砍和三击树木循环 |
| MOD-014 | 盐冠礁床：3403+ 顶点下沉地形、44 岩簇、18 珊瑚簇、34 海草和 3 组鱼群 | `src/game/art/UnderwaterModels.ts` | 海床 TEX-005 与 TEX-041-TEX-047 双图集 PBR 已接通；珊瑚/海草/鱼群继续按材质实例化并使用动态焦散 |
| MOD-015 | 水下资源组：细砂、黏土、盐壳金属矿和长叶海草 | `src/game/art/UnderwaterModels.ts` | 四套独立轮廓与审定 PBR，支持高亮、三段钩击、收割、抖动和消散 |
| MOD-016 | 拾风帆：3.4 米桅杆、桅脚、三道绑扎、双侧受力绳、横桁、分段帆面和风标 | `src/game/art/NavigationModels.ts` | 12+ 网格、900+ 顶点，AI 帆布 PBR 双面渲染，筏格附着 |
| MOD-017 | 潮石锚：木质底座、双立柱、绞盘鼓、轮缘、曲柄、四圈绳卷、垂绳、石坠和双锚爪 | `src/game/art/NavigationModels.ts` | 15+ 网格，自动朝筏外，支持水下部署和筏格损毁 |
| MOD-018 | 潮生作物盆：风化木板、绑绳、角铁、排水口、PBR 培养土、湿润层、4 茎节、9 叶片枢轴、3 果实和种子标记 | `src/game/art/PlantingModels.ts` | 42+ 网格，生长、供水、枯萎和收获分别驱动，不使用整体静态缩放 |
| MOD-019 | 盐翼盗鸟：躯干、胸羽、头颈、喙、双眼眉羽、14 主翼羽、3 尾羽、双腿和 6 趾 | `src/game/art/PlantingModels.ts` | 28+ 网格、700+ 顶点，支持盘旋、俯冲、啄食和惊飞姿态 |
| MOD-020 | 盐迹研究台：支脚、双层台面、斜撑、样本盘、样本碎片、翻页板、比较刻度、旋转拨盘和透镜臂 | `src/game/art/ProgressionModels.ts` | 30+ 网格，样本与项目状态分别驱动页面、拨盘、指示和高亮 |
| MOD-021 | 潮红通风架：双层木轨、编织晾垫、绑扎和四个独立砖位 | `src/game/art/ProgressionModels.ts` | 每砖独立材质、计时、缩放和湿/干状态，不以整架计时替代 |
| MOD-022 | 回潮熔炉：58+ 独立耐火砖、锈蚀束带、烟囱、炉门、通风口、坩埚、矿石、金属锭和分层热源 | `src/game/art/ProgressionModels.ts` | AI 耐火 PBR；工作/完成状态分别驱动炉门、内容物、火、烟、火星和热光 |
| MOD-023 | 潮铸穿浪矛与宽刃斧：回收木柄、潮铸金属刃/矛头、护套、铆接与纤维绑扎 | `src/game/art/ProceduralModels.ts` | 与基础工具共享第一视角节奏但使用独立高阶形体、材质和伤害数据 |
| MOD-024 | 定潮舵台：双层轮缘、八辐手柄、斜撑、盐蚀合金面板、万向罗盘、四枚航线针、三组齿轮与双侧舵索 | `src/game/art/NavigationModels.ts` | 55+ 网格，筏格附着；轮、罗盘、齿轮与航线针按航向/阵风/模式实时驱动 |
| MOD-025 | 横风抗扭索具：双金属横撑、四枚帆缘锁扣和双股交叉受力绳 | `src/game/art/NavigationModels.ts` | 直接加装到既有拾风帆，强化状态、拆除返还和 v8 存档已接通 |
| MOD-026 | 潮镜五联净水器：斜置盐玻璃集热板、合金框、五个独立杯位、分流歧管、冷凝管与蒸汽/滴水层 | `src/game/art/AdvancedDeviceModels.ts` | 55+ 网格、五路水位和完成标记；队列并行推进且无需燃料 |
| MOD-027 | 三槽烟鳍烤台：宽体耐火炉膛、十三根炉条、三组鱼段位、共享燃料条、火焰/余烬/烟层 | `src/game/art/AdvancedDeviceModels.ts` | 70+ 网格；三份平放鱼排独立使用生/熟/焦 PBR，炉口/炉条采用耐热折铁，共享燃料与三状态同屏近景通过 |
| MOD-028 | 干舱储物柜：蜡封帆布柜门/顶盖、木质骨架、潮铸铰链、把手、锁扣和八个内容标记 | `src/game/art/AdvancedDeviceModels.ts` | 25+ 网格；柜盖动画、八格真实堆叠与拆除原子返还已接通 |
| MOD-029 | 深锚锁链棘轮：双爪棘轮、潮铸护圈、短节锁链与加固绞盘 | `src/game/art/NavigationModels.ts` | 直接加装到现有锚具，风暴载荷、滑脱与 v10 强化状态同步 |
| MOD-030 | 潮听接收台：层压机壳、斜置扫描盘、三环二十四刻度、扫描束、三信号点、参考线圈、三频段鼓轮、六电量条与阵列灯 | `src/game/art/SignalModels.ts` | 90+ 网格；断电/在线发光、扫描、调谐、频段点、电量和诊断灯由 v10 导航状态驱动 |
| MOD-031 | 双桅定向阵列：相位箱、双桅、八组绝缘/横臂、六定向环、端帽、冠尖、四股拉索、馈线和传播环 | `src/game/art/SignalModels.ts` | 50+ 网格；桅杆风摆、相位灯和三层传播环按阵列/天气/接收台状态驱动 |
| MOD-032 | 潮痕中继站：三密封浮筒、合金箍、六臂低框、三层冠环、中央桅杆、双环转子、磷光核心和四层脉冲环 | `src/game/art/SignalModels.ts` | 47 网格；位于持续世界坐标，浮筒错相升沉、转子、灯和距离脉冲实时驱动 |
| MOD-033 | 盐封打捞手套：双前臂、编织袖口、掌垫、指节护条、金属扣具、八组双段手指与双拇指 | `src/game/art/FirstPersonModels.ts` | 双手与钩具合计 40+ 网格；主体使用独立 TEX-015，麻编/金属/绳边分层，腕、指、导绳点和投射起点独立驱动 |
| MOD-034 | 木筏结构套件：交错承力墙、绳铰板门、盐封承重柱、双梁七级楼梯、上层拼板和编叶斜顶 | `src/game/art/RaftStructureParts.ts` | 六类结构使用木材/深木/绳/金属/纤维分件和一致尺度语法；门框/门扇分离，运行时合并为最多七个实例批次 |
| MOD-035 | 潮兜收集网：盐蚀木框、铁卡扣、双侧承臂、悬垂绳格、绳结、三浮子、六档装载物、磨损绳与满载标记 | `src/game/art/CollectionNetModel.ts` | 原创程序模型；静态木框/铁件/绳床/浮子按材质合批，货物和健康阶段保持独立动画，筏缘局部坐标防止航行或靠岛时脱离 |
| MOD-036 | 鲨鱼战利品浮包：盐封浮托、交叉绑绳、分件鲨肉、折叠鲨皮与齿板 | `src/game/art/ProceduralModels.ts` | 只用于背包拒收的真实鲨鱼战利品；按内容显隐并复用八槽世界掉落池，不把普通漂流物换皮 |
| MOD-037 | 铁歌漂流阵：五联浮舱、双侧轨道、九组栏柱、五座共鸣腔、摆锤、顶部转子、控制台与脉冲环 | `src/game/art/SignalModels.ts` | 90 网格；宽体远海实体使用 TEX-032，五个摆锤/共鸣腔按目标状态同步 |
| MOD-038 | 风针观测标：三浮舱、三脚塔、四层传感平台、十二组陶瓷取样器、三轴电气笼、三组风向飘带与尖针 | `src/game/art/SignalModels.ts` | 83 网格；高 9m 级实体使用 TEX-033/TEX-032，平台、笼、飘带和脉冲随风/目标驱动 |
| ANI-001 | 木筏三轴波浪升沉 | `src/game/systems/RaftSystem.ts` | 已实现 |
| ANI-002 | 第一人称移动、镜头与木筏局部坐标 | `src/game/systems/PlayerController.ts` | 已实现基础版 |
| ANI-003 | 双手钩具待机、蓄力、放绳跟随、受力抓握、交替回收、抛射旋转、拖回、耐久损耗与断裂恢复 | `src/game/systems/HookSystem.ts`、`src/game/presentation/hookPresentation.ts` | 代码原生腕/指关节、19 点张力绳和手持/抛出唯一所有权已接通；最终蒙皮仍待 DCC |
| ANI-004 | 建造锤挥击、筏格预览、放置、修补与拆除 | `src/game/systems/BuildSystem.ts` | 已实现交互切片 |
| ANI-005 | 钓竿抛投、浮标升沉、三鱼种绕线/挣扎、体型缩放、差异化拉力、张力和收杆 | `src/game/systems/FishingSystem.ts` | 连续三轮真实捕获、部分容量、满包返海、单实例显隐和预热门禁通过 |
| ANI-006 | 鲨鱼尾摆、巡游、逼近、扑咬、受击、撤退、失力侧翻、随浪浮尸与下沉 | `src/game/systems/SharkSystem.ts` | 威胁循环与尸体生命周期共享状态真值 |
| ANI-007 | 设备朝向预览、筏格放置、运行、收取、拆解、碰撞与落海 | `src/game/systems/DeviceSystem.ts` | 已接净水器和烤架完整周期，并保存阶段与进度 |
| ANI-008 | 木筏/岛屿双表面移动、岸线切换、地形贴合和障碍滑移 | `src/game/systems/PlayerController.ts` | 无独立场景切换，可保存玩家所在表面 |
| ANI-009 | 石斧挥动、命中帧、棕榈受击抖动、倒伏和树桩切换 | `src/game/systems/IslandSystem.ts` | 三击状态与收获、粒子、音效同步 |
| ANI-010 | 木筏/岛屿/水域三表面移动、三维游动、上浮/下潜、登筏与上岸 | `src/game/systems/PlayerController.ts` | 水域位置与潜深可保存，地形和礁石碰撞已接通 |
| ANI-011 | 水下钩具挥击、矿点分段生命、海草摇曳、鱼群巡游和鲨鱼追击/扑咬 | `src/game/systems/UnderwaterSystem.ts`、`SharkSystem.ts` | 音效、粒子、UI、生命伤害和击退同步 |
| ANI-012 | 展帆/收帆、帆面逐顶点鼓动、桅顶风标、八向调帆、筏体转向、锚绳伸缩、绞盘旋转和锚爪摆动 | `src/game/systems/NavigationSystem.ts` | 风效、航速、部署状态、UI 和音频同步 |
| ANI-013 | 作物叶片分段萌发/风摆/枯萎下垂、果实减产，以及盐翼盗鸟翼/尾/头颈/抓爪状态动画 | `src/game/systems/PlantingSystem.ts` | 与供水、生长、鸟害和 v8 攻击中恢复同步 |
| ANI-014 | 研究拨盘/页面反馈、逐砖湿干变化、熔炉炉门/内容物/热光阶段 | `src/game/systems/ProgressionSystem.ts` | 与全局知识、逐砖计时、熔炼工作/完成和 v8 恢复同步 |
| ANI-015 | 木矛/金属矛与石斧/金属斧实时换模、挥击和分级命中 | `src/game/systems/SpearSystem.ts`、`IslandSystem.ts` | 升级制作后自动替换快捷栏，鲨鱼和棕榈实际接收不同伤害 |
| ANI-016 | 舵轮修正、罗盘指向、齿轮联动、航线针切换、强化帆鼓动和过载自动泄压 | `src/game/systems/NavigationSystem.ts` | 与四种航线、阵风偏航、帆具载荷、交互、音频和 v10 恢复同步 |
| ANI-017 | 五杯水位/完成标记、三份鱼段独立火候、共享燃料条、柜盖与内容标记 | `src/game/systems/DeviceSystem.ts` | 与高级设备领域队列、真实库存、HUD、音频和 v10 恢复同步；共享燃料、断火续燃、熟优先收取、停止空烧和三状态 PBR 门禁通过 |
| ANI-018 | 锚机棘轮加装、锁链受力、风暴载荷累积与未强化锚滑脱 | `src/game/systems/NavigationSystem.ts` | 与锚泊后果、警报、音频、模型强化和 v10 恢复同步 |
| ANI-019 | 接收台扫描/调谐/电量、双桅相位/传播、三座目标实体浮舱/转子/摆锤/飘带/脉冲与抵达解码 | `src/game/systems/NavigationSystem.ts` | 与电池、间距、活动信号、世界位置、距离、访问解锁、海图选择和 v18 恢复同步 |
| ANI-020 | 结构分件幽灵预览、旋转/层高切换、板门开合、连续楼梯登层、上层落地/分层碰撞、楼板/斜顶撞顶、三档受损色泽/确定性松动和承重级联 | `src/game/systems/BuildSystem.ts`、`RaftStructureSystem.ts`、`PlayerController.ts` | 与材料、锤耐久、共享占位、四向楼梯入口、材质撞顶音尘、鲨鱼外沿择靶、修补 HUD、支撑拓扑和 v15 恢复同步；不增加结构实例批次 |
| ANI-021 | 收集网边缘预览、四向固定、网床波动/装载下沉、六档货物显隐、两档磨损绳、满载脉冲、被动入网、鲨鱼撕咬、修补、收取、锤拆与失托落海 | `src/game/art/CollectionNetModel.ts`、`src/game/systems/CollectionNetSystem.ts` | 与动态筏缘、未钩漂流物、12 件容量、真实生命、背包接收、锤耐久、世界掉落和 v17 恢复同步 |
| ANI-022 | 潮铸筏缘护甲预览、安装、盐蚀合金四边导轨、锈蚀角片、铆固件和拆卸返料 | `src/game/systems/BuildSystem.ts`、`src/game/systems/RaftSystem.ts` | 固定实例预算随动态筏格姿态和 v17 `reinforced` 真值同步，保护同格基础、暴露结构和边挂网具 |
| ANI-023 | 鲨体四段按住割取、伤痕逐段显现、聚焦环呼吸、取尽下沉与健康重生 | `src/game/systems/SharkSystem.ts` | 与 0.86 秒分段进度、52 秒窗口、满包落海、48 秒冷却和 v18 恢复同步；起手精确瞄准，持续阶段允许有限水面晃动 |
| VFX-001 | 入水粒子 | `src/game/systems/SplashSystem.ts` | 已实现 |
| VFX-002 | 木屑、纤维屑、修补金屑、拆除、武器和咬击冲击粒子 | `src/game/systems/SplashSystem.ts` | 结构撕咬按生命/是否毁损分双层数量、色泽、尺寸和抛速；锤修按木材/纤维分层 |
| VFX-003 | 五层加色火焰、动态点光、五块余烬和八层烟雾 | `src/game/art/ProceduralModels.ts` | 火势与设备阶段联动，焦鱼阶段转为深色烟 |
| VFX-004 | 净水蒸汽、海水退位、杯中水位和循环滴水 | `src/game/systems/DeviceSystem.ts` | 蒸馏进度实时驱动，不使用位图序列 |
| VFX-005 | 岸线泡沫脉动、资源高亮、木屑/石屑/叶片分类冲击 | `src/game/systems/IslandSystem.ts` | 跟随岛屿阶段、焦点和采集事件驱动 |
| VFX-006 | 水下雾色/曝光过渡、双面海面、滚动焦散、气泡、悬浮物和矿屑 | `src/game/systems/UnderwaterSystem.ts`、`DriftwakeGame.ts` | 随潜深和玩家表面驱动；水下关闭不符合物理的硬阴影 pass |
| VFX-007 | 航行设备放置冲击、脉动交互环、帆面风压形变、风标和水下锚爪 | `src/game/systems/NavigationSystem.ts` | 随帆向、风力利用与部署插值实时驱动 |
| VFX-008 | 作物盆放置冲击、湿土覆盖、种子标记、生长叶冠、枯萎材质、果实节点和交互高亮 | `src/game/systems/PlantingSystem.ts` | 随作物领域状态实时驱动 |
| VFX-009 | 耐火砖湿干材质、五层加色炉火、动态点光、炉烟、火星、矿石退场、金属锭凝固和设备高亮 | `src/game/systems/ProgressionSystem.ts` | 预览态关闭动态热源；运行时粒子循环复用并随熔炼阶段驱动 |
| VFX-010 | 内向飑云穹顶、330 条高画质/160 条低画质 GPU 实例雨线、双段闪电、风暴雾光、增幅波浪和泡沫 | `src/game/systems/StormSystem.ts`、`DriftwakeGame.ts`、`src/game/shaders/ocean.ts` | 云、雨、海况、曝光和雷声由同一确定性天气强度驱动；水下关闭不适用的表面雨幕 |
| VFX-011 | 五路冷凝蒸汽/滴水、三槽火焰/焦烟/鱼体材质、柜盖阻尼和内容物标记 | `src/game/systems/DeviceSystem.ts` | 所有可见状态由领域队列、燃料、火候和真实储物内容驱动，不使用菜单假状态 |
| VFX-012 | 磷光扫描束/信号点、相位灯、三层阵列传播环、四层中继脉冲和距离驱动显隐 | `src/game/systems/NavigationSystem.ts` | 所有发光与脉冲由在线、电量、目标与真实世界距离驱动；断电状态不保留假扫描 |
| VFX-013 | 近距打捞聚焦环、分类拾取冲击与池化海面剩余物资 | `src/game/systems/SalvageSystem.ts`、`DebrisField.ts` | 注视角、距离、背包接收结果和 v11 世界掉落状态共同驱动，不静默吞物资 |
| VFX-014 | 收集网固定冲击、分类入网飞沫、装载下沉、满载灯、鲨鱼受击/毁坏、锤修金屑、锤拆碎屑和失托落海双层水花 | `src/game/systems/CollectionNetSystem.ts`、`CollectionNetModel.ts` | 所有状态由真实网具容量、生命、筏格 revision、缘甲减伤和漂流物结算驱动，不使用菜单假状态 |
| VFX-015 | 鲨鱼失力冲击、浮尸出水、四段肉屑/水滴、青色聚焦环和取尽/超时下沉 | `src/game/systems/SplashSystem.ts`、`SharkSystem.ts` | 粒子、镜头反馈和伤痕只由实际击杀/采集事务触发，满包拒收不会伪造入包反馈 |
| VFX-016 | 三座远海目的地的浮舱错相、共鸣摆锤、三轴观测笼、风向飘带和距离/访问脉冲 | `src/game/systems/NavigationSystem.ts`、`src/game/art/SignalModels.ts` | 发现/接近/激活/访问共享领域状态，隐藏目标不运行发光和脉冲 |

## 程序音频分层

全部由 Web Audio API 在运行时合成，不引用第三方音频文件：

| 层 | 内容 | 位置 |
| --- | --- | --- |
| MUSIC | 三音低频漂流和声与独立慢速 LFO | `src/game/systems/AudioSystem.ts` |
| AMB-SEA/WIND | 低通棕噪海浪、带通风层、双 LFO | `src/game/systems/AudioSystem.ts` |
| AMB-RAFT | 随机木结构吱响 | `src/game/systems/AudioSystem.ts` |
| AMB-ISLAND | 距离驱动的叶冠风层和稀疏双音鸟鸣 | `src/game/systems/AudioSystem.ts` |
| AMB-UNDERWATER | 世界总线动态低通、水体低频脉动和呼吸警告；UI 总线保持清晰 | `src/game/systems/AudioSystem.ts` |
| AMB-STORM | 独立低通风压、带通雨噪、慢速阵风幅度变化，以及双段闪光触发的雷声簇 | `src/game/systems/AudioSystem.ts` |
| SFX-HOOK/BUILD | 抛钩、HRTF 空间落水、五类物资方位碰撞、居中背包确认、近场受力收绳、断钩、木击、按木/纤维修补、结构空间断裂/坍塌、拆除、拒绝反馈与板门木铰/摩擦层 | `src/game/systems/AudioSystem.ts` |
| SFX-NET | 木框双击固定、绳格高频收紧、按漂流物重量区分的空间入网、背包收取双音和失托木裂/绳断/水体低频层 | `src/game/systems/AudioSystem.ts` |
| SFX-FISHING | 抛线、浮标、三连鱼讯、卷线、断线，以及按鱼种拉力与体型份数分层的搏鱼/捕获音 | `src/game/systems/AudioSystem.ts` |
| SFX-DEVICE | 放置木/铁冲击、五联海水装填、三槽食物位、干舱开合/物资双向转移、点火、完成、焦糊、持续火焰和蒸汽层 | `src/game/systems/AudioSystem.ts` |
| SFX-ISLAND | 木筏/沙地脚步、石斧破风、入木、倒树、枝料/石料/植被拾取 | `src/game/systems/AudioSystem.ts` |
| SFX-REEF | 入水/游动、钩刃擦水、细砂/黏土/金属分层撞击和海草收割 | `src/game/systems/AudioSystem.ts` |
| SFX-NAV | 帆布受风持续带通层、展收帆摩擦、调帆绳索、索具锁紧、帆具过载、舵台拨档、锚链坠落、棘轮强化与滑脱/绞盘回收 | `src/game/systems/AudioSystem.ts` |
| SFX-SIGNAL | 接收机带通底噪、电池接通、继电器开关、调谐扫频、距离驱动双音脉冲、目标抵达和阵列成功/故障诊断 | `src/game/systems/AudioSystem.ts` |
| SFX-DESTINATION | 潮痕中继站低频继电脉冲、铁歌漂流阵多谐波金属合唱、风针观测标滤波风噪/电气层；距离衰减、立体声声像和当前目标强调 | `src/game/systems/AudioSystem.ts` |
| SFX-PLANT | 土壤落种、倒水低通/水滴音、成熟三音提示、干裂叶响和收获层 | `src/game/systems/AudioSystem.ts` |
| SFX-RESEARCH | 开台、样本落盘/刻度确认、项目学习和纸页/金属拨盘反馈 | `src/game/systems/AudioSystem.ts` |
| SFX-FORGE | 湿砖落架、干砖裂响、矿石/细砂/燃料装填、持续炉火、金属或玻璃完成凝固与收取层 | `src/game/systems/AudioSystem.ts` |
| CREATURE | 鲨鱼低频预兆、扑咬冲击、武器命中、失力低频、浮尸水层、分段割取和取尽/流失下沉；盐翼盗鸟警报、啄食和惊飞 | `src/game/systems/AudioSystem.ts` |
| UI | 短促确认、拒绝和工具切换 | `src/game/systems/AudioSystem.ts` |

设置界面分别控制 `master`、`music`、`ambience`、`effects`、`creatures` 和 `ui` 六个增益总线，偏好写入独立版本化配置。世界音效经过随相机世界位置、前向和上方向更新的监听器；M2 打捞事件使用 HRTF 反距离定位，UI 确认不进入空间节点。

## 后续硬任务

- 用 Blender 或等效 DCC 建立可蒙皮的最终双手、工具、鲨鱼和生活设备资产，当前代码模型是原创近最终形体基线而非最终蒙皮资产；
- 为木材补充经过人工修整的 normal、roughness 与 AO；鲨皮和编织纤维已使用独立派生图；
- 在图像服务稳定时重试 TEX-003/TEX-004 候选，并只在人工平铺和材质球对比优于程序版时替换；TEX-005 至 TEX-033 已采用高质量输出；
- 建立同一角色比例与材质语言下的模型规范；
- 为岛屿补充手绘沙地/草地/岩面材质组、草丛层级和更丰富的岸线小物，保持现有确定性地形与碰撞接口；
- 为漂流箱桶、最终双手/钩具、木筏结构套件、潮兜收集网、珊瑚、海草、鱼群、水下钩具、拾风帆、强化索具/锚具、定潮舵台、接收台/阵列/中继标、高级生活设备、作物、盐翼盗鸟、研究台、通风架、熔炉和金属工具建立最终 DCC 模型、蒙皮与顶点动画，保留当前布局和领域接口；
- 录制或生成多样本海浪、绳索、木结构、研究器械、湿砖、金属、火焰、蒸汽、烹饪和鲨鱼音效，保留当前程序音频作动态底层；
- 为所有最终资产建立来源、版本、修改记录和发布授权结论。
