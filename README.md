# Driftwake

原创网页 3D 海上生存游戏，目前处于高质量纵向切片阶段。

## 当前内容

- 原创标题主视觉、木材纹理与定向海面泡沫遮罩；
- Three.js 程序化海面、天空、远景岛、四阶段天气、720 秒昼夜与风向/风险变化；
- 带波浪升沉的 3x3 木筏、固定 60 Hz 模拟、同步升沉/倾斜的 Rapier 移动甲板 collider 和第一人称键鼠移动；
- 跳跃、离筏、落水、游泳、表面防穿筏侧、下潜穿过筏底、游回木筏和边缘攀回闭环；
- 木料、聚合片、纤维和补给箱漂流物；
- 蓄力抛钩、飞行、绳索、入水、命中、拖回和收获流程；
- 海浪、风、雨、木筏结构、抛钩、落水、收获、UI、音乐和水下低通音景；主音量/音乐/环境/音效/UI 五组独立控制；
- 水下颜色/雾化过渡、水花、水中操作提示，以及可平滑关闭步行起伏与木筏倾斜的镜头舒适开关；
- 高/低画质与动态分辨率，HUD/长稳证据记录 FPS、渲染比例、draw calls、三角面、几何、纹理和 Heap；
- 菜单首屏与 3D 世界分 chunk，首次点击后才加载 Three.js/Rapier 世界运行时；
- 标题界面、环境/性能 HUD、快捷栏、可滚动设置与移动设备能力页；
- Rapier 物理初始化、Vitest 逻辑测试和 Playwright 截图脚本。

当前实现不是完整游戏。建造、鲨鱼、钓鱼、岛屿探索、研究与存档仍按追踪文档继续开发。

## 运行

```sh
npm install
npm run dev
```

默认地址由 Vite 输出。桌面 Chrome / Edge、键鼠与 WebGL2 是当前目标环境。标题页首次点击“开始漂流”会加载 3D 世界；出现“进入海面”后再次点击，以用户手势获取 Pointer Lock 并开始模拟。

## 操作

- `WASD`：木筏移动或水中游动；
- 鼠标：观察；按住并释放左键进行钩具蓄力与投掷；
- `Space`：在木筏上跳跃；水中上浮并在边缘攀回；
- `C` 或 `Ctrl`：下潜；
- `E`：在木筏边缘触发攀回；
- `Esc`：释放 Pointer Lock，点击画面可继续。

## 验证

```sh
npm test
npm run build
npm run test:collision
npm run test:motion-comfort
npm run capture
npm run test:stability
```

`npm run test:collision` 使用状态条件而不是固定墙钟等待，验证玩家离筏后在水面被移动甲板 collider 阻挡、下潜后从筏底抵达另一侧，并从边缘攀回；可通过 `DRIFTWAKE_URL`、`CHROMIUM_PATH` 和 `PLAYWRIGHT_HEADFUL` 调整运行环境。

`npm run test:motion-comfort` 在确定性风暴海况下通过公开设置执行镜头摇晃 `on → off → on`，验证木筏镜头倾斜平滑降至接近水平后可恢复；运行时同时公开基于 world-Y swing–twist 分解的历史峰值步进，并硬性要求每个固定步不超过 `0.7 rad/s ÷ 60 Hz = 0.668°`。流程还会检查 Pointer Lock、模拟门禁、WebGL Context 与浏览器错误。

`npm run capture` 默认连接 `http://127.0.0.1:4173`，可通过 `DRIFTWAKE_URL`、`CHROMIUM_PATH`、`CAPTURE_WIDTH` 和 `CAPTURE_HEIGHT` 调整。标题场景会确认玩家首次点击前没有 Canvas，并检查整页 PNG 内容；进入世界后再验证 Canvas/Context、合成 PNG 的非空画面指标，以及游戏、夜间风暴、钩具蓄力、水下行动、短视口音频/画质设置和移动能力页流程。设置 `DRIFTWAKE_FORCE_BLANK_FRAME=1 CAPTURE_ONLY=title` 可验证整页空白帧门禁会按预期红灯。

`npm run test:stability` 默认运行 1200 秒，并通过设置 UI 选择低画质，以 1280×720、18 件 active 漂流物、30 FPS、**最低渲染比例 100%**、32 MB 最大 Heap 增长作为门槛；设置 `STABILITY_QUALITY=high` 时默认切换为高质量 1920×1080、30 件 active 漂流物、60 FPS，同样要求全程保持 100% 渲染比例。达到完整周期时还会要求四种天气与昼夜亮度范围。可通过 `STABILITY_SECONDS`、`STABILITY_SAMPLE_SECONDS`、`STABILITY_CONTENT_SECONDS`、`STABILITY_QUALITY`、`STABILITY_VIEWPORT_WIDTH`、`STABILITY_VIEWPORT_HEIGHT`、`STABILITY_MIN_FPS`、`STABILITY_MIN_RENDER_SCALE`、`STABILITY_ALLOW_SOFTWARE_RENDERER`、`STABILITY_MAX_HEAP_GROWTH_MB`、`STABILITY_MIN_WEATHER_KINDS` 和 `STABILITY_MIN_DAYLIGHT_RANGE` 调整。每次运行同时写入带时间戳的 `artifacts/stability/stability-*.json` 和 `latest.json`，并记录入口/世界 runtime 资源名、全程画质集合和漂流物数量范围。软件渲染环境降低 FPS/渲染比例阈值只能作为功能、Heap 与 Context soak，不能替代目标设备性能验收。

目标 GPU 两档命令：

```sh
STABILITY_QUALITY=low npm run test:stability
STABILITY_QUALITY=high npm run test:stability
```

仅做 SwiftShader 功能/Heap/Context soak 时必须显式放宽，示例：

```sh
STABILITY_MIN_FPS=1 STABILITY_MIN_RENDER_SCALE=0.55 STABILITY_ALLOW_SOFTWARE_RENDERER=1 npm run test:stability
```

## 图像生成

`scripts/imagegen` 会在运行时读取：

- `$CODEX_HOME/config.toml` 中当前 provider 的 `base_url`；
- `$CODEX_HOME/auth.json` 中的 `OPENAI_API_KEY`。

仓库不保存密钥。示例：

```sh
scripts/imagegen generate --prompt "..." --quality high --out output/imagegen/example.png
```

## 文档

- [项目追踪](PROJECT_TRACKER.md)
- [原创资产清单](docs/ASSET_MANIFEST.md)

