# M9 深潮鲨 DCC 交付合同

> 版本：`0.22.15`
> 合同与验证器：`READY`
> 专用牙龈 Image 2 源图：`BLOCKED`（provider 无兼容账号）
> 最终可蒙皮 DCC / GLB：`BLOCKED`（本环境无 Blender，尚未交付资产）

## 边界

当前运行时的代码原生 oral rig v1、24 齿牙列、下颌、牙龈带、口腔内腔、眼口 PBR 和完整玩法继续保留。它已通过自动画面与预算门禁，但不冒充最终可蒙皮 DCC 鲨体。本切片交付的是可执行的资产合同和验证器，使下一环境产生的模型必须满足同一套结构、材质、动画和 Web 包体要求。

机器合同位于 `docs/contracts/graywake-shark-dcc-v1.json`，验证实现位于 `scripts/shark-dcc-contract.mjs`。候选资产固定放在 `public/assets/models/graywake-shark.glb`，验证命令为：

```sh
npm run validate:shark-dcc -- public/assets/models/graywake-shark.glb
```

没有该文件时，`release:check` 只报告 `contentGates.sharkDcc=pending-dcc-delivery`；文件一旦出现，解析或合同错误会直接使候选失败。

## 坐标与容器

- GLB 2.0、单个内部 BIN chunk，禁止外链 buffer；所有 bufferView/accessor 必须对齐并完整落在声明的内部字节范围内，禁止 sparse 存储和隐藏尾随载荷；
- 米制、`+Y` 向上、`-Z` 鼻端向前，与现有追击/镜头合同一致；
- 包围盒宽/高/长须落在 `1.8..2.8 / 0.9..2.2 / 4.0..6.0 m`；
- 文件不超过 `1,600,000` bytes，给最后一格牙龈共享图集和候选包清单保留空间；
- 只允许必须扩展 `KHR_mesh_quantization`，不得把 Draco、Meshopt 或私有解码器偷偷带进运行时；
- GLB 不内嵌图片或纹理。DCC 可在原生工程内预览贴图，但运行 GLB 只保留命名材质槽，由项目已审定 PBR 运行时重映射。

`asset.extras.driftwake` 必须声明合同版本、坐标、米制、原创资产、运行时材质重映射、来源 DCC 和实际米制包围盒。验证器会从每个绑定网格的 POSITION min/max 与完整节点世界变换重新计算宽/高/长，并要求和元数据在 5 cm 内一致；不接受只改自报尺寸来掩盖导出比例错误。缺失元数据、非有限变换、matrix/TRS 混用、层级环、零缩放轴和未归一化旋转四元数也会被拒绝。

## 几何与材质

运行几何预算为 `12,000..36,000` triangles、最多 `50,000` vertices。所有绑定网格必须提供 `POSITION / NORMAL / TEXCOORD_0`；蒙皮网格另须提供四影响的 `JOINTS_0 / WEIGHTS_0`，属性计数必须与 POSITION 一致，索引必须为无符号整数。

| 节点 | 运行材质槽 |
| --- | --- |
| `shark-body` | `graywake-shark-skin` |
| `shark-eye-port` / `shark-eye-starboard` | `graywake-lateral-eye` |
| `shark-mouth-lining` | `graywake-mouth-lining` |
| `shark-gingiva-upper` / `shark-gingiva-lower` | `graywake-gingiva` |
| `shark-teeth-upper` / `shark-teeth-lower` | `graywake-tooth-enamel` |
| `shark-flesh-overlay` | `graywake-shark-flesh` |

额外材质或合同外网格会被拒绝，避免未登记贴图、调试体和重复隐藏网格进入包体。`shark-body`、上下牙龈和伤痕层必须引用 skin；上下齿可作为对应颌骨的刚性子层。

## 骨骼与动画

必须且只能有一个 skin，包含 13 至 48 个唯一有效 joints、匹配数量的 MAT4 inverse bind matrices，并以 `shark-rig-root` 为 skeleton。v1 最少包含根、尸体滚转、前/中脊柱、三节尾、下颌、双鳃盖、双胸鳍和背鳍；验证器同时锁定从 root 到尾尖以及下颌/鳃/鳍的父子拓扑，不能用一组平铺空节点通过。

| Clip | 时长范围 | 必须驱动 |
| --- | ---: | --- |
| `swim_loop` | 0.8-4.0 s | 尾根、尾中、尾尖 |
| `attack_windup` | 0.35-1.2 s | 前脊柱、下颌 |
| `attack_bite` | 0.1-0.6 s | 下颌、前脊柱 |
| `attack_recover` | 0.35-1.5 s | 下颌、尾根 |
| `hit_react` | 0.2-0.8 s | 前/中脊柱 |
| `death_roll` | 1.0-4.0 s | rig root、尸体滚转 |
| `corpse_float` | 2.0-8.0 s | rig root、尾根 |

GLB 动画集合必须精确等于这七段，不允许残留调试 clip。动画必须从 0 秒开始，具备有限递增时间范围、匹配的输入/输出数量和 FLOAT VEC3/VEC4 输出；禁止 STEP 插值及合同外 target path。最终运行接线还需把七段 clip 映射到 `SharkSystem` 的巡游、蓄势、咬合、回摆、受击、死亡和浮尸阶段，并验证失焦冻结与恢复不跳帧。

## 牙龈 Image 2

最终提示词已从忽略的 `tmp/` 固化为 `docs/prompts/graywake-gingiva-image2.txt`。本切片执行：

```sh
scripts/imagegen generate --model gpt-image-2 --quality high --size 2048x2048 \
  --prompt-file docs/prompts/graywake-gingiva-image2.txt \
  --out artifacts/imagegen/graywake-gingiva-raw.png --output-format png \
  --no-augment --force
```

dry-run 精确得到 `/v1/images/generations`、`gpt-image-2`、`high`、`2048x2048` 和 PNG；正式请求按 2/4 秒退避执行三次，均返回 `503 No available compatible accounts`。没有输出文件、TEX-053、PBR 派生、图集区域或运行时改动，也没有切换模型、质量或程序贴图。

服务恢复后仍须人工审定原图，再单独确定 seam、normal 与 roughness 参数；不得直接照搬口衬数值。采用版会填入现有 4x4 共享图集最后一格，增加 `[graywake-gingiva]` 浏览器断言，并重跑正式咬筏 `32/32`、水下、结构、周界和完整候选包预算。

## 完成条件

以下条件全部通过前，本项保持 `BLOCKED`：

1. 原生 DCC 工程、原创权属记录和通过本验证器的 GLB 同时归档；
2. 专用牙龈采用源、三通道 PBR、2x2 平铺、共享图集和材质映射通过；
3. 七段动画实际接入玩法状态，眼、牙、牙龈、口腔容积、鳃和胸鳍在攻击/受击/浮尸中没有穿插；
4. `shark-facial-materials`、正式咬筏、取材、水下和跨系统材质场景全部通过；
5. 1280x720/30 与 1920x1080/60 真实 GPU 复验 mip、各向异性、骨骼变形、屏幕覆盖、包体和 20 分钟稳定性。
