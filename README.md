# Driftwake

原创桌面网页 3D 海上生存游戏。当前版本为 `0.3.0` 高质量纵向切片，不以基础 Demo 为完成标准。

## 当前内容

- Three.js 程序化海面、天空、雾、远景岛、昼光和随波木筏；
- 第一人称移动、蓄力抛钩、绳索、水花、漂流物命中和补给箱战利品；
- 数据驱动的 18 类物品、20 格堆叠背包、7 项便携配方、消耗品和固定步长生存状态；
- 可寻址木筏筏格、邻接建造、幽灵预览、材料校验、修补、拆除与连通性保护；
- 浮标抛投、鱼讯窗口、张力/收线对抗、断线、鱼体挣扎和收获；
- 可放置的潮汐净水器与折铁烤架，包含杯具回收、木材燃料、蒸馏、烤制、收取和过烧；
- 设备附着筏格、玩家碰撞、拆解返还、随筏格落海、状态 HUD 和独立火焰/蒸汽/食物动画；
- 原创程序鲨鱼模型、巡游、预兆、选边、咬筏、结构损伤、木矛命中和驱离；
- v2 版本化自动存档，保存物品、生存状态、当前工具、航行时间、逐格筏体耐久和设备状态，并迁移 v1 存档；
- 六总线程序音频混音：音乐、海况、交互、危险、界面和总音量；
- 标题、HUD、背包、制作、设置、能力提示和 Playwright 截图回归流程；
- 原创标题美术、木材、泡沫、鲨皮和编织纤维材质，以及独立 normal/roughness 图。

当前仍不是完整游戏。种植、可探索岛屿、水下采集、研究、熔炼与导航仍按 [项目追踪](PROJECT_TRACKER.md) 继续开发。

## 运行

```sh
npm ci
npm run dev -- --port 4173
```

目标环境为带真实 GPU、WebGL2 和键鼠的桌面 Chrome / Edge。当前交互包括：鼠标抛投/刺击/建造，`E` 操作筏上设备，数字键切换工具，`I` 或 `Tab` 打开背包，`C` 打开制作。

## 验证

```sh
npm test
npm run build
npm run capture
```

截图脚本默认连接 `http://127.0.0.1:4173`，支持 `DRIFTWAKE_URL`、`CHROMIUM_PATH`、`CAPTURE_WIDTH`、`CAPTURE_HEIGHT` 和 `CAPTURE_ONLY`。可选截图目标包括 `title`、`game`、`hook`、`pack`、`crafting`、`devices`、`settings` 和 `mobile`。游戏截图会读取 WebGL 像素并拒绝黑屏或已丢失的上下文。

Termux Chromium + SwiftShader 会在完整场景首帧后丢失 WebGL 上下文；标题、背包、制作、设置和移动能力页可以在该环境验收，完整 3D 必须在真实 GPU 环境复验。

## 资产管线

`scripts/imagegen` 会在运行时读取当前 Codex provider 的 `base_url` 与本地认证文件中的 API Key，仓库不会保存服务 URL 或密钥：

```sh
scripts/imagegen generate --prompt "..." --quality high --out output/imagegen/example.png
```

确定性材质兜底和 normal/roughness 派生需要 Pillow：

```sh
python scripts/generate_procedural_materials.py --out-dir public/assets/textures --size 1024
python scripts/derive_material_maps.py --input albedo.webp --normal normal.webp --roughness roughness.webp
```

完整来源、最终提示词、采用/拒绝结论和模型清单见 [原创资产清单](docs/ASSET_MANIFEST.md)。
