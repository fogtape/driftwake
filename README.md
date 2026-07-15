# Driftwake

原创桌面网页 3D 海上生存游戏。当前版本为 `0.4.0` 高质量纵向切片，不以基础 Demo 为完成标准。

## 当前内容

- Three.js 程序化海面、天空、雾、昼光、随波木筏和可接近的高度场岛屿；
- 第一人称移动、蓄力抛钩、绳索、水花、漂流物命中和补给箱战利品；
- 数据驱动的 22 类物品、20 格堆叠背包、8 项便携配方、消耗品和固定步长生存状态；
- 可寻址木筏筏格、邻接建造、幽灵预览、材料校验、修补、拆除与连通性保护；
- 浮标抛投、鱼讯窗口、张力/收线对抗、断线、鱼体挣扎和收获；
- 可放置的潮汐净水器与折铁烤架，包含杯具回收、木材燃料、蒸馏、烤制、收取和过烧；
- 设备附着筏格、玩家碰撞、拆解返还、随筏格落海、状态 HUD 和独立火焰/蒸汽/食物动画；
- 原创程序鲨鱼模型、巡游、预兆、选边、咬筏、结构损伤、木矛命中和驱离；
- 岛屿远景接近、靠岸、无切场登岛、地形坡度与障碍碰撞、返筏后离流和下一岛重生；
- 18 个确定性岛屿资源节点、石斧三击砍伐、树木受击/倒伏/树桩、枝料/石料/潮果/纤维拾取和满包保护；
- v3 版本化自动存档，保存玩家所在表面、岛屿周期、资源节点生命、逐格筏体和设备状态，并迁移 v1/v2 存档；
- 六总线程序音频混音，以及沙地脚步、叶冠风层、鸟鸣、斧击、倒树和分类拾取声音；
- 标题、HUD、背包、制作、设置、能力提示和 Playwright 截图回归流程；
- 原创标题美术、木材、泡沫、鲨皮和编织纤维材质，以及独立 normal/roughness 图。

当前仍不是完整游戏。水下礁区、氧气、显式锚泊、种植、研究、熔炼、导航和最终蒙皮资产仍按 [项目追踪](PROJECT_TRACKER.md) 继续开发。

## 运行

```sh
npm ci
npm run dev -- --port 4173
```

目标环境为带真实 GPU、WebGL2 和键鼠的桌面 Chrome / Edge。当前交互包括：鼠标抛投/刺击/砍伐/建造，`E` 操作设备或拾取岛上资源，数字键切换工具，`I` 或 `Tab` 打开背包，`C` 打开制作。

## 验证

```sh
npm test
npm run build
npm run capture
```

截图脚本默认连接 `http://127.0.0.1:4173`，支持 `DRIFTWAKE_URL`、`CHROMIUM_PATH`、`CAPTURE_WIDTH`、`CAPTURE_HEIGHT` 和 `CAPTURE_ONLY`。目标包括 `title`、`game`、`hook`、`pack`、`crafting`、`devices`、`island`、`island-interaction`、`narrow`、`settings` 和 `mobile`。3D 截图使用分布式 WebGL 像素门禁，拒绝黑屏、白屏和丢失的上下文。

Termux Chromium 149 的纯 headless 后端会在任意 WebGL draw call 后首次 readback 时丢失上下文。脚本在 Termux 下会自动启动临时 Xvfb 并走 headful GLES 路径，完成后自动清理；真实 GPU 下的 20 分钟稳定性和性能仍需单独验收。

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
