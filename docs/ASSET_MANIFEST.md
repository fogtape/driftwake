# 原创资产清单

> 更新日期：2026-07-15  
> 状态：首轮美术基线，发布前仍需做最终授权与相似性复核

## 管线原则

- 不从任何商业游戏提取、描摹或重新分发模型、贴图、动画、UI 和音频；
- AI 位图通过项目 `scripts/imagegen` 调用配置 provider 生成，仓库不保存服务 URL 或密钥；
- 运行时模型、动画和音效均为项目代码原生生成；
- AI 输出先进入忽略版本控制的 `output/imagegen/`，人工检查后才转换到 `public/assets/`；
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

## 代码原生模型与动画

| ID | 资产 | 位置 | 当前状态 |
| --- | --- | --- | --- |
| MOD-001 | 3x3 木筏：27 木板、18 横梁、36 铆钉 | `src/game/systems/RaftSystem.ts` | 已实例化，视觉数量不变 |
| MOD-002 | 打捞钩：木柄、弯钩、尖端、五圈绳缠 | `src/game/art/ProceduralModels.ts` | 已用于第一视角与投射物 |
| MOD-003 | 木料、聚合容器、纤维叶、补给箱 | `src/game/art/ProceduralModels.ts` | 已进入漂流物对象池 |
| MOD-004 | 远景岛：岩体、沙洲、树干和 42 片叶 | `src/game/art/ProceduralModels.ts` | 已批量实例化 |
| ANI-001 | 木筏三轴波浪升沉 | `src/game/systems/RaftSystem.ts` | 已实现 |
| ANI-002 | 第一人称移动、镜头与木筏局部坐标 | `src/game/systems/PlayerController.ts` | 已实现基础版 |
| ANI-003 | 钩具蓄力、抛射、旋转、拖回与收起 | `src/game/systems/HookSystem.ts` | 已实现基础闭环 |
| VFX-001 | 入水粒子 | `src/game/systems/SplashSystem.ts` | 已实现 |

## 程序音频分层

全部由 Web Audio API 在运行时合成，不引用第三方音频文件：

| 层 | 内容 | 位置 |
| --- | --- | --- |
| AMB-SEA | 低通棕噪声、周期性海浪涌动 | `src/game/systems/AudioSystem.ts` |
| AMB-WIND | 带通高频风层、低频 LFO 调制 | `src/game/systems/AudioSystem.ts` |
| AMB-RAFT | 随机木结构吱响 | `src/game/systems/AudioSystem.ts` |
| SFX-HOOK | 抛钩风切、金属低音、落水双噪声层 | `src/game/systems/AudioSystem.ts` |
| SFX-LOOT | 双音收获确认 | `src/game/systems/AudioSystem.ts` |
| UI | 短促正弦界面反馈 | `src/game/systems/AudioSystem.ts` |

## 后续硬任务

- 用 Blender 或等效 DCC 建立可蒙皮的最终双手、工具和鲨鱼资产；
- 为木材生成经过人工修整的 normal、roughness 与 AO，不长期依赖 albedo 兼作 bump；
- 建立同一角色比例与材质语言下的模型规范；
- 录制或生成多样本海浪、绳索、木结构、金属和鲨鱼音效，保留当前程序音频作动态底层；
- 为所有最终资产建立来源、版本、修改记录和发布授权结论。
