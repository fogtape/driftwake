# M1 验收记录

日期：2026-07-18

## 结论

M1 的功能、逻辑回归、浏览器运行时回归、手机电脑模式暂停入口和软件 GLES 稳定性已形成可复现闭环。M1 donor 没有整分支合并；只吸收了运行时、镜头、动态分辨率、稳定性证据和碰撞验收思想，main 的 M2-M8 内容、v10 存档、动态筏格、六总线音频、海况/水下 shader 与大型 capture 流程均保留。

本记录不把本设备 Debian rootfs/Xvfb 的 Mesa llvmpipe 软件渲染结果视为发布性能结论。真实桌面 GPU 双 profile、原生 rAF、真 Context Lost/Restore 和完整手感验收仍属于 M9 发布门禁。

## 已完成范围

- 60 Hz 固定步模拟、渲染插值、最大子步和模拟积压丢弃；
- phase、Pointer Lock、设置/面板、窗口焦点、页面可见性和 WebGL Context 联合门禁；
- 连续昼夜环境采样接入既有海面、风暴和水下表现；
- 木筏水平参考系、动态筏格 Rapier collider、水面筏侧阻挡与深潜通行；
- 木筏/岛屿跳跃、落地和三档镜头舒适过滤；
- 动态分辨率、冷却防抖、恢复策略与漂流物运行时质量预算；
- 音频失焦/隐藏静音与恢复；
- 标题页零世界资源、首次意图延迟加载、稳定暂停态和 Pointer Lock 拒绝恢复；
- 长稳 runner 与 FPS、frame p95、render scale、heap、Context、动态筏格、漂流物、帧驱动和画面内容证据。
- 钩具手持/抛射视觉唯一归属、截图输入去副作用，以及按动态筏格前缘计算的岛屿停靠净距与旧存档坐标迁移。

## 自动证据

| 门禁 | 命令/场景 | 结果 |
| --- | --- | --- |
| 逻辑与领域回归 | `npm test` | 25 个测试文件、132 项通过 |
| 生产构建 | `npm run build` | TypeScript/Vite 通过；CSS 63.69 kB、入口 299.34 kB、游戏 869.91 kB、Rapier 2,237.42 kB 且保持独立 chunk |
| M1 浏览器闭环 | `npm run test:m1-runtime` | 标题延迟加载、跳跃/落地、镜头切档、焦点门禁、Context 生命周期、动态筏格 collider 与最终画布内容通过 |
| 钩具视觉所有权 | `CAPTURE_ONLY=planting-interaction`、`planting-bird`、`hook` | 两个种植场景均为 `idle + 仅手持`；主动抛射为 `flying + 手持隐藏 + 抛射体/绳索可见` |
| 大木筏靠岛与帆附着 | `CAPTURE_ONLY=signal` | 35 筏格场景中 `sailAttachment=raft`，完整岛屿网格与筏前缘净距 0.18m，接收台交互与窄屏 HUD 通过 |
| 手机电脑模式暂停 | `CAPTURE_ONLY=pause CAPTURE_WIDTH=920 CAPTURE_HEIGHT=1600 npm run capture` | 首击进入暂停页；相机高度 1.54；Canvas 920x1600；Pointer Lock 拒绝后仍保持可操作暂停层 |
| 代表游戏帧 | `CAPTURE_ONLY=game CAPTURE_WIDTH=1280 CAPTURE_HEIGHT=720 npm run capture` | WebGL2 Context 健康，画面非黑/非白，筏体、海面、地平线和 HUD 正常 |
| 软件诊断 | Debian Chromium 150，30 秒低画质 profile | 7 个样本、3 个内容样本；Context/门禁/碰撞/漂流物预算无失败 |
| 软件长稳 | Debian Chromium 150，1200 秒低画质 profile | 121 个状态样本、5 个内容样本；全程所有权有效，Context/浏览器错误/策略失败均为 0 |

代表截图：

- `artifacts/screenshots/pause-desktop-mode.png`
- `artifacts/screenshots/game-desktop.png`
- `artifacts/screenshots/planting-interaction-desktop.png`
- `artifacts/screenshots/planting-bird-desktop.png`
- `artifacts/screenshots/hook-desktop.png`
- `artifacts/screenshots/signal-network-desktop.png`

## 2026-07-18 视觉回归修复

- `HookSystem` 现在以状态机决定第一人称模型：`idle/charging` 才能显示手持钩，`flying/latched/retracting` 只保留世界抛射体和绳索；运行时 dataset 与单元测试共同防止双模型回归。
- `capture.mjs` 不再在 Pointer Lock 已生效时额外点击 Canvas；种植、研究、导航和信号场景改用无副作用的锁定检查，并用非阻塞提示读取与确定性测试站位稳定构图。
- `IslandSystem` 使用当前筏格最前排、岛屿完整地形半深和 0.18m 安全距计算停靠目标。35 筏格信号场景的岛岸与筏板之间重新出现可读水带，帆脚座和索具清楚落在木板上。
- v10 存档内的岛屿状态增加 `dockVersion` 小版本标记；旧存档第一次读取时按旧停靠参考系验证岛屿/水下坐标，再平移到新停靠参考系，写回后不重复迁移。
- Termux SwiftShader 的 Playwright `page.screenshot` 可能在字体完成后卡住合成，目标 3D 截图改用 CDP 合成层抓取；画布像素门禁仍独立检查 Context 与内容。

30 秒诊断使用 Debian Chromium 150、1280x720 低画质和 llvmpipe：FPS p10 6、中位数 15，最低 render scale 0.7，9 个筏格始终对应 9 个 collider，18 个漂流物预算稳定，无 Context Lost、浏览器错误或验收失败。软件渲染与截图造成 42.229 秒累计模拟丢弃，runner 已如实记录；软件功能 profile 对该性能项单独放宽，不能用于宣称实时模拟或目标帧率。

冻结 bundle `index-z5i6k_Ot.js / DriftwakeGame-BimsP7vm.js` 的 1200 秒复验以退出码 0 完成：

- renderer 为 Mesa llvmpipe / OpenGL ES 3.2，FPS p10 为 2、中位数 15，render scale 为 0.7-1；
- Pointer Lock 与模拟全程有效，Context Lost、浏览器错误和 `failures` 均为 0；
- Heap 起点 33,723,697、终点 31,969,997、峰值 41,655,787 bytes；保留增长 1,346,660 bytes，斜率约 21,474 bytes/分钟；
- draw calls 为 53-210，三角面峰值 98,592；最后 20 个样本的 geometry 稳定在 123-124、texture 固定为 9；
- 鲨鱼破坏使筏格从 9 减到 8，对应 Rapier collider 同步从 9 减到 8；18 个漂流物预算全程不变；
- 模拟 tick 从 46 增至 24,637；软件低帧和画面编码造成 802.189 秒累计模拟丢弃，功能 profile 显式允许，真实 GPU profile 仍只允许默认的 0.5 秒；
- 时间戳证据：`artifacts/stability/stability-2026-07-17T12-14-57-159Z.json`，`latest.json` 已回读指向同一结果。

## 环境筛选记录

- Android Chromium 149 + Xvfb/GLES 首轮长跑在第 1050 秒检查前丢失 Context；最后成功样本位于 958 秒，Heap 斜率约 0.11 MB/分钟、筏格 collider 与漂流物预算稳定，但出现 shader validation 错误，因此该运行判定失败；
- Android Chromium 与 Debian Chromium 的 headless/SwiftShader 在本设备首个完整世界 draw/readback 即 Context Lost，不能用于验收；
- Debian Chromium 150 + Xvfb/headful GLES 先通过 30 秒筛选，随后冻结版 1200 秒复验通过；
- 上述分流是为了找到本设备可工作的软件证据环境，不会放宽 Context Lost、浏览器错误、画面内容或 Heap 门禁。

成功的软件功能 profile 在已有 Xvfb 的 Debian rootfs 内使用：

```sh
DISPLAY=:299 PLAYWRIGHT_HEADFUL=1 CHROMIUM_PATH=/usr/bin/chromium \
STABILITY_SECONDS=1200 STABILITY_SAMPLE_SECONDS=10 STABILITY_CONTENT_SECONDS=300 \
STABILITY_ALLOW_SOFTWARE_RENDERER=1 STABILITY_MIN_FPS=1 STABILITY_MIN_RENDER_SCALE=0.6 \
STABILITY_MAX_DROPPED_SECONDS=2400 DRIFTWAKE_URL=http://127.0.0.1:4180 \
node scripts/stability.mjs
```

`:299` 只是本次空闲 display 编号，复现时应替换为实际 Xvfb display。

## 真实 GPU 待验收

在桌面 Chrome/Edge、真实 GPU 和生产预览服务上分别执行：

```sh
STABILITY_QUALITY=low STABILITY_SECONDS=1200 npm run test:stability
STABILITY_QUALITY=high STABILITY_SECONDS=1200 npm run test:stability
M1_REAL_CONTEXT_LOSS=1 npm run test:m1-runtime
```

低 profile 要求 1280x720、p10 不低于 30 FPS；高 profile 要求 1920x1080、p10 不低于 60 FPS。两者都必须满足：

- renderer 不是 SwiftShader、llvmpipe、softpipe 或软件光栅器；
- 全程只使用 `frameDriver=native`；
- Pointer Lock 与模拟所有权全程有效；
- 无 Context Lost、浏览器错误、黑/白画布或动态筏格 collider 漂移；
- render scale 不低于该次发布设定；
- retained heap、heap slope 和模拟丢弃不超过 runner 策略阈值。

真机完成后保留 `artifacts/stability/latest.json` 的外部副本，并把 renderer、两档摘要和人工眩晕/交互结论回填到本文件。
