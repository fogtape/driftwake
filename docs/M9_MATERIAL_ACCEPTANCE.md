# M9 工具与打捞材质整改验收

> 版本：`0.22.1`
> 日期：2026-07-22
> 当前环境状态：`DONE`（代码、来源、PBR、平铺、真实交互与软件 framebuffer 证据闭环）
> 外部门禁：目标真实 GPU 双画质、十分钟打捞手感、最终 DCC 蒙皮与授权/相似性复核

## 本轮范围

本轮只处理 M9 历史材质队列中“第一人称工具与漂流物”P1 项，不把岛屿、水下、结构或生物微材质提前标记完成：

1. 原 `darkWood / rope / metal / rustMetal / polymer` 不再是纯色最终材质；
2. 新增潮缚索具与盐蚀工具钢两套原创 `gpt-image-2 high` 源图和独立 1024 PBR；
3. TEX-001 风化雪松补齐 1254 normal/roughness，深木与三种筏板共享同源但使用不同偏移/乘色；
4. 通用回收聚合物复用已审定 TEX-024，而不再新造相同语义的低质贴图；
5. 打捞回收包在普通漂流物穿越准星时保持优先，并使用有界的 4.5m/1.1m 软锁；普通补给箱仍保持原 3.8m/0.72m 阈值。

## 来源与处理

| 材质 | 源图 | 生成 | 运行时 | 接缝 |
| --- | --- | --- | --- | --- |
| 潮缚索具 | `artifacts/imagegen/tidebound-rigging-raw.png` | 项目 `scripts/imagegen`，`gpt-image-2`，`high`，2048x2048 | `tidebound-rigging*.webp`，1024，normal 0.68，roughness 184-246 | x=13.52/1.00x，y=13.73/1.02x |
| 盐蚀工具钢 | `artifacts/imagegen/brineworn-tool-steel-raw.png` | 项目 `scripts/imagegen`，`gpt-image-2`，`high`，2048x2048 | `brineworn-tool-steel*.webp`，1024，normal 0.56，roughness 112-194 | x=7.29/1.08x，y=10.22/1.00x |
| 风化雪松 | 既有审定 TEX-001 | 沿用 Image 2 high albedo | 新增 `weathered-cedar-normal/roughness.webp`，1254 | 既有 2x2 连续性保持 |
| 盐蚀聚合物 | 既有审定 TEX-024 | 沿用 Image 2 high 源图 | `salt-etched-polymer*.webp`，1024 | x=8.92/1.07x，y=8.36/0.88x |

完整提示词、采用参数和拒绝项见 `docs/ASSET_MANIFEST.md`。两套新增源图均从本地配置 provider 调用，仓库没有保存 URL、API Key 或第三方商业素材。

## 运行时绑定

- `wood[0..2] / darkWood`：同源 albedo/normal/roughness，独立 UV 偏移与色调；
- `rope`：潮缚索具 PBR，覆盖钩具、网具、浮包和设备绑扎；
- `metal / rustMetal`：盐蚀工具钢同源，两套 metalness/roughness/色调分别表达维护钢与锈蚀五金；
- `polymer`：盐蚀聚合物 PBR，覆盖聚合漂流物、网具浮子和回收容器；
- `Materials.test.ts` 锁定新增纹理路径、唯一加载以及五类材质的 albedo/normal/roughness 绑定。

## 浏览器闭环

复现：

```sh
CAPTURE_ONLY=salvage CAPTURE_FAST=1 npm run capture
```

当前证据：

- 使用当前帧相机与活动世界掉落坐标精确瞄准，仍通过真实 `KeyE` 事件结算；
- 回收包优先级与有界软锁避免普通动态补给箱在输入瞬间抢焦点；
- 结算后活动世界掉落 `1 -> 0`，HUD 精确为 `2 棕榈纤维 / 1 氧化废铁`，木材/聚合物未因误捡增加；
- 一点耐久钩在筏面真实蓄力后断裂，所有手持/投射/绳索实例清空；
- 替代钩完成制作后恢复 `48/48`，状态为 `idle + held`，投射物和绳索均隐藏；
- `salvage-pickup-canvas.png` 通过双 rAF 后的 WebGL framebuffer 直读生成，不使用 X11 空合成层冒充画面；雪松、深木、手套、索具、工具钢和回收包同场可见。
- 当前场景 `renderer.info.memory.textures=20`，低于沿用的 M5 发布预算上限 32；门禁会在非有限值或超过 32 时直接失败。

## 自动验证

```sh
npx vitest run src/game/art/Materials.test.ts src/game/systems/SalvageSystem.test.ts --maxWorkers=1
npx vitest run --maxWorkers=1
npm run build
node --check scripts/capture.mjs
python -m py_compile scripts/prepare_imagegen_material.py scripts/derive_material_maps.py
git diff --check
```

最终基线：50 个测试文件、322 项测试通过；生产构建和打捞浏览器闭环通过。新增运行时材质为 8 张 WebP（两套三图、雪松两张派生图），新增 2 张 2048 原创源 PNG；没有低质占位或纯色贴图进入该 P1 范围。

## 外部门禁

当前 Termux/Xvfb 软件 GLES 可以证明绑定、像素内容、交互状态和构图，但不能替代以下发布验收：

- 目标真实 GPU 上 1280x720/30 与 1920x1080/60 的各十分钟打捞；
- 钩体在白天、夜间、风暴和水下边缘的材质响应及绳索运动清晰度；
- HRTF、断裂/回收音层与真实音频设备混音；
- 第一人称双手、钩具、锤/矛/斧的最终 DCC 蒙皮、UV 与动作遮挡；
- 源图授权、C2PA/生成记录、品牌/商标和与商业作品的最终相似性复核。
