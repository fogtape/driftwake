# 原创资产清单

> 更新日期：2026-07-15  
> 状态：第二轮美术与材质基线，发布前仍需做最终授权、DCC 替换与相似性复核

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

## 本轮 Imagegen 尝试

调用方式：项目 `scripts/imagegen`，配置文件 provider，模型 `gpt-image-2`，质量 `high`。分别尝试 2048x2048 WebP、2048x2048 PNG 和 1024x1024 PNG，串行并带重试；请求均在服务端响应头之前超时，未产生可评审输出，也未降级到其他模型。

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

| ID | 资产 | 位置 | 当前状态 |
| --- | --- | --- | --- |
| MOD-001 | 可扩展木筏：每格 3 木板、2 横梁、4 铆钉 | `src/game/systems/RaftSystem.ts` | 动态实例化，支持逐格损伤、修补和拆除 |
| MOD-002 | 打捞钩：木柄、弯钩、尖端、五圈绳缠 | `src/game/art/ProceduralModels.ts` | 已用于第一视角与投射物 |
| MOD-003 | 木料、聚合容器、纤维叶、补给箱 | `src/game/art/ProceduralModels.ts` | 已进入漂流物对象池 |
| MOD-004 | 远景岛：岩体、沙洲、树干和 42 片叶 | `src/game/art/ProceduralModels.ts` | 已批量实例化 |
| MOD-005 | 建造锤：木柄、金属锤头、撞面、拔钉爪、六圈绑带 | `src/game/art/ProceduralModels.ts` | 已进入第一视角建造与修补 |
| MOD-006 | 木矛：长杆、金属尖端与五圈扎结 | `src/game/art/ProceduralModels.ts` | 已进入第一视角刺击 |
| MOD-007 | 钓竿、卷线轮、浮标与银脊鱼 | `src/game/art/ProceduralModels.ts` | 已进入抛投、鱼讯、挣扎和收获循环 |
| MOD-008 | 深潮鲨：车削躯干、背鳍、胸鳍、尾柄、双叶尾、眼、口与鳃 | `src/game/art/ProceduralModels.ts` | 12+ 独立网格，已接巡游、袭击与受击动画 |
| ANI-001 | 木筏三轴波浪升沉 | `src/game/systems/RaftSystem.ts` | 已实现 |
| ANI-002 | 第一人称移动、镜头与木筏局部坐标 | `src/game/systems/PlayerController.ts` | 已实现基础版 |
| ANI-003 | 钩具蓄力、抛射、旋转、拖回与收起 | `src/game/systems/HookSystem.ts` | 已实现基础闭环 |
| ANI-004 | 建造锤挥击、筏格预览、放置、修补与拆除 | `src/game/systems/BuildSystem.ts` | 已实现交互切片 |
| ANI-005 | 钓竿抛投、浮标升沉、鱼体绕线、张力和收杆 | `src/game/systems/FishingSystem.ts` | 已实现完整单次循环 |
| ANI-006 | 鲨鱼尾摆、巡游、逼近、扑咬、受击、撤退与下潜 | `src/game/systems/SharkSystem.ts` | 已实现第一轮威胁循环 |
| VFX-001 | 入水粒子 | `src/game/systems/SplashSystem.ts` | 已实现 |
| VFX-002 | 木屑、修补、拆除、武器和咬击冲击粒子 | `src/game/systems/SplashSystem.ts` | 颜色与数量按事件区分 |

## 程序音频分层

全部由 Web Audio API 在运行时合成，不引用第三方音频文件：

| 层 | 内容 | 位置 |
| --- | --- | --- |
| MUSIC | 三音低频漂流和声与独立慢速 LFO | `src/game/systems/AudioSystem.ts` |
| AMB-SEA/WIND | 低通棕噪海浪、带通风层、双 LFO | `src/game/systems/AudioSystem.ts` |
| AMB-RAFT | 随机木结构吱响 | `src/game/systems/AudioSystem.ts` |
| SFX-HOOK/BUILD | 抛钩、落水、收获、木击、修补、拆除与拒绝反馈 | `src/game/systems/AudioSystem.ts` |
| SFX-FISHING | 抛线、浮标、三连鱼讯、卷线、捕获与断线 | `src/game/systems/AudioSystem.ts` |
| CREATURE | 鲨鱼低频预兆、扑咬冲击与武器命中 | `src/game/systems/AudioSystem.ts` |
| UI | 短促确认、拒绝和工具切换 | `src/game/systems/AudioSystem.ts` |

设置界面分别控制 `master`、`music`、`ambience`、`effects`、`creatures` 和 `ui` 六个增益总线，偏好写入独立版本化配置。

## 后续硬任务

- 用 Blender 或等效 DCC 建立可蒙皮的最终双手、工具和鲨鱼资产，当前代码模型是原创近最终形体基线而非最终蒙皮资产；
- 为木材补充经过人工修整的 normal、roughness 与 AO；鲨皮和编织纤维已使用独立派生图；
- 在可稳定访问图像服务的环境重试 TEX-003/TEX-004 候选，并只在人工平铺和材质球对比优于程序版时替换；
- 建立同一角色比例与材质语言下的模型规范；
- 录制或生成多样本海浪、绳索、木结构、金属和鲨鱼音效，保留当前程序音频作动态底层；
- 为所有最终资产建立来源、版本、修改记录和发布授权结论。
