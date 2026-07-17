# 原创资产清单

> 更新日期：2026-07-17
> 状态：第九轮舵台、强化帆具与风暴航线美术交互基线，发布前仍需做最终授权、DCC 替换与相似性复核

## 管线原则

- 不从任何商业游戏提取、描摹或重新分发模型、贴图、动画、UI 和音频；
- AI 位图通过项目 `scripts/imagegen` 调用配置 provider 生成，仓库不保存服务 URL 或密钥；
- 运行时模型、动画和音效均为项目代码原生生成；
- AI 输出先进入忽略版本控制的 `output/imagegen/`，人工检查后才转换到 `public/assets/`；
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

### TEX-001：风化雪松 Albedo

| 字段 | 内容 |
| --- | --- |
| 运行时文件 | `public/assets/textures/weathered-cedar.webp` |
| 模型 | `gpt-image-2` |
| 请求质量 | `high` |
| 请求尺寸 | `2048x2048` |
| 实际尺寸 | `1254x1254` |
| 用途 | 木筏、钩具木柄与木质漂流物 |
| 检查 | 2x2 平铺无明显边缝；无透视、文字、金属件和强烘焙阴影 |

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

## 本轮 Imagegen 尝试

调用方式：项目 `scripts/imagegen`，运行时读取配置文件 provider，模型 `gpt-image-2`，质量 `high`。本轮 2048x2048 PNG 导航合金和飑云请求分别在 44.0/90.6 秒完成并通过人工内容检查；耐火陶土、培养土、帆布和海床此前分别为 46.8/93.6/47.2/38.1 秒。没有在仓库保存 provider URL 或 API Key，也没有切换低阶模型。先前鲨皮与编织纤维请求的超时记录继续保留，它们仍使用确定性程序版本。

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

## 代码原生模型与动画

本轮定潮舵台、强化帆具和风暴层需要确定性响应航线、风向、阵风、载荷、筏格位置和跨版本存档，因此继续以代码原生形体与实时动画建立统一可玩的近最终基线。导航合金使用独立 AI PBR，风暴天空使用独立 AI 云层材质；没有因软件截图后端较慢而降低运行时贴图质量。

| ID | 资产 | 位置 | 当前状态 |
| --- | --- | --- | --- |
| MOD-001 | 可扩展木筏：每格 3 木板、2 横梁、4 铆钉 | `src/game/systems/RaftSystem.ts` | 动态实例化，支持逐格损伤、修补和拆除 |
| MOD-002 | 打捞钩：木柄、弯钩、尖端、五圈绳缠 | `src/game/art/ProceduralModels.ts` | 已用于第一视角与投射物 |
| MOD-003 | 木料、聚合容器、纤维叶、补给箱 | `src/game/art/ProceduralModels.ts` | 已进入漂流物对象池 |
| MOD-004 | 远景岛原型：岩体、沙洲、树干和 42 片叶 | `src/game/art/ProceduralModels.ts` | 保留为历史原型，运行时已由可探索岛替代 |
| MOD-005 | 建造锤：木柄、金属锤头、撞面、拔钉爪、六圈绑带 | `src/game/art/ProceduralModels.ts` | 已进入第一视角建造与修补 |
| MOD-006 | 木矛：长杆、金属尖端与五圈扎结 | `src/game/art/ProceduralModels.ts` | 已进入第一视角刺击 |
| MOD-007 | 钓竿、卷线轮、浮标与银脊鱼 | `src/game/art/ProceduralModels.ts` | 已进入抛投、鱼讯、挣扎和收获循环 |
| MOD-008 | 深潮鲨：车削躯干、背鳍、胸鳍、尾柄、双叶尾、眼、口与鳃 | `src/game/art/ProceduralModels.ts` | 12+ 独立网格，已接巡游、袭击与受击动画 |
| MOD-009 | 潮汐净水器：绑扎木架、火盆、海水槽、编织蒸馏罩、冷凝沟、滴管与透明杯具 | `src/game/art/ProceduralModels.ts` | 35+ 独立网格，运行阶段驱动海水/净水水位和滴水 |
| MOD-010 | 折铁烤架：绑扎木架、折铁火盆、九根炉条、横撑、把手与银脊鱼 | `src/game/art/ProceduralModels.ts` | 40+ 独立网格，食物按生/熟/焦状态改变颜色与粗糙度 |
| MOD-011 | 盐冠浅滩：2115 顶点高度场、顶点色分层、5 个岩石地标、22 个灌木和 30 条岸浪 | `src/game/art/ProceduralModels.ts` | 已进入接近、靠岸、登岛、离流和重生周期 |
| MOD-012 | 岛屿资源组：4 棕榈、枝料、石堆、潮果、纤维簇与交互高亮 | `src/game/art/ProceduralModels.ts` | 节点独立、内部实例化，支持生命、拾取、倒伏和树桩 |
| MOD-013 | 潮磨石斧：回收木柄、石质斧头、金属刃口和六圈编织绑带 | `src/game/art/ProceduralModels.ts` | 已进入第一视角挥砍和三击树木循环 |
| MOD-014 | 盐冠礁床：3403+ 顶点下沉地形、44 岩簇、18 珊瑚簇、34 海草和 3 组鱼群 | `src/game/art/UnderwaterModels.ts` | 珊瑚/海草/鱼群按材质实例化，AI 海床 PBR 材质与动态焦散已接通 |
| MOD-015 | 水下资源组：细砂、黏土、盐壳金属矿和长叶海草 | `src/game/art/UnderwaterModels.ts` | 四套独立轮廓，支持高亮、三段钩击、收割、抖动和消散 |
| MOD-016 | 拾风帆：3.4 米桅杆、桅脚、三道绑扎、双侧受力绳、横桁、分段帆面和风标 | `src/game/art/NavigationModels.ts` | 12+ 网格、900+ 顶点，AI 帆布 PBR 双面渲染，筏格附着 |
| MOD-017 | 潮石锚：木质底座、双立柱、绞盘鼓、轮缘、曲柄、四圈绳卷、垂绳、石坠和双锚爪 | `src/game/art/NavigationModels.ts` | 15+ 网格，自动朝筏外，支持水下部署和筏格损毁 |
| MOD-018 | 潮生作物盆：风化木板、绑绳、角铁、排水口、PBR 培养土、湿润层、4 茎节、9 叶片枢轴、3 果实和种子标记 | `src/game/art/PlantingModels.ts` | 42+ 网格，生长、供水、枯萎和收获分别驱动，不使用整体静态缩放 |
| MOD-019 | 盐翼盗鸟：躯干、胸羽、头颈、喙、双眼眉羽、14 主翼羽、3 尾羽、双腿和 6 趾 | `src/game/art/PlantingModels.ts` | 28+ 网格、700+ 顶点，支持盘旋、俯冲、啄食和惊飞姿态 |
| MOD-020 | 盐迹研究台：支脚、双层台面、斜撑、样本盘、样本碎片、翻页板、比较刻度、旋转拨盘和透镜臂 | `src/game/art/ProgressionModels.ts` | 30+ 网格，样本与项目状态分别驱动页面、拨盘、指示和高亮 |
| MOD-021 | 潮红通风架：双层木轨、编织晾垫、绑扎和四个独立砖位 | `src/game/art/ProgressionModels.ts` | 每砖独立材质、计时、缩放和湿/干状态，不以整架计时替代 |
| MOD-022 | 回潮熔炉：58+ 独立耐火砖、锈蚀束带、烟囱、炉门、通风口、坩埚、矿石、金属锭和分层热源 | `src/game/art/ProgressionModels.ts` | AI 耐火 PBR；工作/完成状态分别驱动炉门、内容物、火、烟、火星和热光 |
| MOD-023 | 潮铸穿浪矛与宽刃斧：回收木柄、潮铸金属刃/矛头、护套、铆接与纤维绑扎 | `src/game/art/ProceduralModels.ts` | 与基础工具共享第一视角节奏但使用独立高阶形体、材质和伤害数据 |
| MOD-024 | 定潮舵台：双层轮缘、八辐手柄、斜撑、盐蚀合金面板、万向罗盘、三枚航线针、三组齿轮与双侧舵索 | `src/game/art/NavigationModels.ts` | 55+ 网格，筏格附着；轮、罗盘、齿轮与航线针按航向/阵风/模式实时驱动 |
| MOD-025 | 横风抗扭索具：双金属横撑、四枚帆缘锁扣和双股交叉受力绳 | `src/game/art/NavigationModels.ts` | 直接加装到既有拾风帆，强化状态、拆除返还和 v8 存档已接通 |
| ANI-001 | 木筏三轴波浪升沉 | `src/game/systems/RaftSystem.ts` | 已实现 |
| ANI-002 | 第一人称移动、镜头与木筏局部坐标 | `src/game/systems/PlayerController.ts` | 已实现基础版 |
| ANI-003 | 钩具蓄力、抛射、旋转、拖回与收起 | `src/game/systems/HookSystem.ts` | 已实现基础闭环 |
| ANI-004 | 建造锤挥击、筏格预览、放置、修补与拆除 | `src/game/systems/BuildSystem.ts` | 已实现交互切片 |
| ANI-005 | 钓竿抛投、浮标升沉、鱼体绕线、张力和收杆 | `src/game/systems/FishingSystem.ts` | 已实现完整单次循环 |
| ANI-006 | 鲨鱼尾摆、巡游、逼近、扑咬、受击、撤退与下潜 | `src/game/systems/SharkSystem.ts` | 已实现第一轮威胁循环 |
| ANI-007 | 设备朝向预览、筏格放置、运行、收取、拆解、碰撞与落海 | `src/game/systems/DeviceSystem.ts` | 已接净水器和烤架完整周期，并保存阶段与进度 |
| ANI-008 | 木筏/岛屿双表面移动、岸线切换、地形贴合和障碍滑移 | `src/game/systems/PlayerController.ts` | 无独立场景切换，可保存玩家所在表面 |
| ANI-009 | 石斧挥动、命中帧、棕榈受击抖动、倒伏和树桩切换 | `src/game/systems/IslandSystem.ts` | 三击状态与收获、粒子、音效同步 |
| ANI-010 | 木筏/岛屿/水域三表面移动、三维游动、上浮/下潜、登筏与上岸 | `src/game/systems/PlayerController.ts` | 水域位置与潜深可保存，地形和礁石碰撞已接通 |
| ANI-011 | 水下钩具挥击、矿点分段生命、海草摇曳、鱼群巡游和鲨鱼追击/扑咬 | `src/game/systems/UnderwaterSystem.ts`、`SharkSystem.ts` | 音效、粒子、UI、生命伤害和击退同步 |
| ANI-012 | 展帆/收帆、帆面逐顶点鼓动、桅顶风标、八向调帆、筏体转向、锚绳伸缩、绞盘旋转和锚爪摆动 | `src/game/systems/NavigationSystem.ts` | 风效、航速、部署状态、UI 和音频同步 |
| ANI-013 | 作物叶片分段萌发/风摆/枯萎下垂、果实减产，以及盐翼盗鸟翼/尾/头颈/抓爪状态动画 | `src/game/systems/PlantingSystem.ts` | 与供水、生长、鸟害和 v8 攻击中恢复同步 |
| ANI-014 | 研究拨盘/页面反馈、逐砖湿干变化、熔炉炉门/内容物/热光阶段 | `src/game/systems/ProgressionSystem.ts` | 与全局知识、逐砖计时、熔炼工作/完成和 v8 恢复同步 |
| ANI-015 | 木矛/金属矛与石斧/金属斧实时换模、挥击和分级命中 | `src/game/systems/SpearSystem.ts`、`IslandSystem.ts` | 升级制作后自动替换快捷栏，鲨鱼和棕榈实际接收不同伤害 |
| ANI-016 | 舵轮修正、罗盘指向、齿轮联动、航线针切换、强化帆鼓动和过载自动泄压 | `src/game/systems/NavigationSystem.ts` | 与三种航线、阵风偏航、帆具载荷、交互、音频和 v8 恢复同步 |
| VFX-001 | 入水粒子 | `src/game/systems/SplashSystem.ts` | 已实现 |
| VFX-002 | 木屑、修补、拆除、武器和咬击冲击粒子 | `src/game/systems/SplashSystem.ts` | 颜色与数量按事件区分 |
| VFX-003 | 五层加色火焰、动态点光、五块余烬和八层烟雾 | `src/game/art/ProceduralModels.ts` | 火势与设备阶段联动，焦鱼阶段转为深色烟 |
| VFX-004 | 净水蒸汽、海水退位、杯中水位和循环滴水 | `src/game/systems/DeviceSystem.ts` | 蒸馏进度实时驱动，不使用位图序列 |
| VFX-005 | 岸线泡沫脉动、资源高亮、木屑/石屑/叶片分类冲击 | `src/game/systems/IslandSystem.ts` | 跟随岛屿阶段、焦点和采集事件驱动 |
| VFX-006 | 水下雾色/曝光过渡、双面海面、滚动焦散、气泡、悬浮物和矿屑 | `src/game/systems/UnderwaterSystem.ts`、`DriftwakeGame.ts` | 随潜深和玩家表面驱动；水下关闭不符合物理的硬阴影 pass |
| VFX-007 | 航行设备放置冲击、脉动交互环、帆面风压形变、风标和水下锚爪 | `src/game/systems/NavigationSystem.ts` | 随帆向、风力利用与部署插值实时驱动 |
| VFX-008 | 作物盆放置冲击、湿土覆盖、种子标记、生长叶冠、枯萎材质、果实节点和交互高亮 | `src/game/systems/PlantingSystem.ts` | 随作物领域状态实时驱动 |
| VFX-009 | 耐火砖湿干材质、五层加色炉火、动态点光、炉烟、火星、矿石退场、金属锭凝固和设备高亮 | `src/game/systems/ProgressionSystem.ts` | 预览态关闭动态热源；运行时粒子循环复用并随熔炼阶段驱动 |
| VFX-010 | 内向飑云穹顶、330 条高画质/160 条低画质 GPU 实例雨线、双段闪电、风暴雾光、增幅波浪和泡沫 | `src/game/systems/StormSystem.ts`、`DriftwakeGame.ts`、`src/game/shaders/ocean.ts` | 云、雨、海况、曝光和雷声由同一确定性天气强度驱动；水下关闭不适用的表面雨幕 |

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
| SFX-HOOK/BUILD | 抛钩、落水、收获、木击、修补、拆除与拒绝反馈 | `src/game/systems/AudioSystem.ts` |
| SFX-FISHING | 抛线、浮标、三连鱼讯、卷线、捕获与断线 | `src/game/systems/AudioSystem.ts` |
| SFX-DEVICE | 放置木/铁冲击、点火、完成提示、焦糊反馈、持续火焰噪声和蒸汽高通层 | `src/game/systems/AudioSystem.ts` |
| SFX-ISLAND | 木筏/沙地脚步、石斧破风、入木、倒树、枝料/石料/植被拾取 | `src/game/systems/AudioSystem.ts` |
| SFX-REEF | 入水/游动、钩刃擦水、细砂/黏土/金属分层撞击和海草收割 | `src/game/systems/AudioSystem.ts` |
| SFX-NAV | 帆布受风持续带通层、展收帆摩擦、调帆绳索、索具锁紧、帆具过载泄压、舵台拨档、锚链坠落和绞盘回收 | `src/game/systems/AudioSystem.ts` |
| SFX-PLANT | 土壤落种、倒水低通/水滴音、成熟三音提示、干裂叶响和收获层 | `src/game/systems/AudioSystem.ts` |
| SFX-RESEARCH | 开台、样本落盘/刻度确认、项目学习和纸页/金属拨盘反馈 | `src/game/systems/AudioSystem.ts` |
| SFX-FORGE | 湿砖落架、干砖裂响、矿石/燃料装填、持续炉火、完成凝固和收锭金属层 | `src/game/systems/AudioSystem.ts` |
| CREATURE | 鲨鱼低频预兆、扑咬冲击与武器命中；盐翼盗鸟警报、啄食和惊飞 | `src/game/systems/AudioSystem.ts` |
| UI | 短促确认、拒绝和工具切换 | `src/game/systems/AudioSystem.ts` |

设置界面分别控制 `master`、`music`、`ambience`、`effects`、`creatures` 和 `ui` 六个增益总线，偏好写入独立版本化配置。

## 后续硬任务

- 用 Blender 或等效 DCC 建立可蒙皮的最终双手、工具、鲨鱼和生活设备资产，当前代码模型是原创近最终形体基线而非最终蒙皮资产；
- 为木材补充经过人工修整的 normal、roughness 与 AO；鲨皮和编织纤维已使用独立派生图；
- 在图像服务稳定时重试 TEX-003/TEX-004 候选，并只在人工平铺和材质球对比优于程序版时替换；TEX-005 至 TEX-010 已采用高质量输出；
- 建立同一角色比例与材质语言下的模型规范；
- 为岛屿补充手绘沙地/草地/岩面材质组、草丛层级和更丰富的岸线小物，保持现有确定性地形与碰撞接口；
- 为珊瑚、海草、鱼群、水下钩具、拾风帆、强化索具、潮石锚、定潮舵台、作物、盐翼盗鸟、研究台、通风架、熔炉和金属工具建立最终 DCC 模型、蒙皮与顶点动画，保留当前布局和领域接口；
- 录制或生成多样本海浪、绳索、木结构、研究器械、湿砖、金属、火焰、蒸汽、烹饪和鲨鱼音效，保留当前程序音频作动态底层；
- 为所有最终资产建立来源、版本、修改记录和发布授权结论。
