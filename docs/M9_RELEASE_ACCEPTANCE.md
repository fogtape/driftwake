# M9 候选发布与异常恢复验收

> 日期：2026-07-25
> 版本：`0.22.15`
> 状态：`APPROVED`（候选构建、资产来源、第三方许可、包体预算、生产包 Context 与音频图生命周期闭环；目标 GPU、真实设备混音、20 分钟长稳、外部玩家与项目自身许可仍是外部门禁）

## 发布合同

```sh
npm ci
RELEASE_REQUIRE_CLEAN=1 npm run release:check
```

命令按顺序执行全量 Vitest、TypeScript 与 Vite `release` 构建、资产来源核对、生产依赖许可核对、包体预算、生产包 Context 生命周期和音频图/母带生命周期门禁。任一阶段失败都会令命令非零退出，同时把失败阶段写入 `artifacts/release/latest.json`。

`0.22.15` 实测为 54 个测试文件、339 项通过；候选资产、依赖和包体分别为 113 个运行时资产、45 个采用源、9 个生产依赖、130 个文件和 51,956,509 bytes。技术候选通过不改变下述内容与外部门禁状态。

`release` 模式不生成或引用 sourcemap；普通 `npm run build` 继续保留映射供本地诊断。字体入口收窄为 Barlow Condensed 与 Manrope 的 Latin 子集，中文继续使用现有系统字体回退，不改变字重或界面布局。

候选产物是 `dist/` 静态目录：

- `index.html` 不得预载 `DriftwakeGame` 或 Rapier，首次玩家意图前保持无 Canvas；
- `THIRD_PARTY_NOTICES.txt` 包含锁定版本、SPDX、来源、用途和每个生产包的完整许可文本；
- `release-manifest.json` 记录候选版本、Git commit 和其余每个文件的 bytes/SHA-256；
- `index.html` 应短缓存或重新验证；带 hash 的 JS/CSS/字体可以不可变长缓存，未带 hash 的 `assets/textures` 和 `assets/art` 必须重新验证；
- 实际托管必须提供 HTTPS、正确的 JS/CSS/font/WebP MIME 和 SPA 根路径回退。游戏不依赖 API 服务，航次仅保存在当前来源的 localStorage。

## 来源与许可门禁

`release/runtime-dependencies.json` 是生产依赖声明。检查器从 `package-lock.json` 根依赖开始递归遍历，不接受漏项、陈旧项、SPDX 不一致、HTTP 来源或缺失许可正文。本轮得到九个运行时包：Rapier、两套 Fontsource 字体、Lucide、React/React DOM/Scheduler、Three.js 与 Zustand。

资产门禁不只检查文档中的显式完整路径：所有 `public/assets` 文件以及所有采用的 `artifacts/imagegen/*-raw.png` 都必须以完整路径或唯一文件名出现在 `docs/ASSET_MANIFEST.md`。本轮结果：

- 运行时资产 `113`；
- 采用源图 `45`；
- 显式 `public/assets` 路径 `28`；
- 未登记 `0`，缺失 `0`。

本切片没有新增或降级任何位图，因此没有触发新的 Image 2 采用；既有高质量运行时资产原样进入候选包。`0.22.13` 只将钓鱼浮漂和聚合漂流物瓶盖的局部纯色绑定改为既有 TEX-024 聚合物 PBR，未重采样、未扩图集；`0.22.14` 只改造 Web Audio 混音底盘；`0.22.15` 固化牙龈最终提示词并增加 DCC 合同/验证器，不把合同冒充成品资产。项目 `scripts/imagegen` 对 SDK 502/503/504 使用有界退避；本轮 `gpt-image-2 high 2048x2048` dry-run 通过，正式牙龈请求三次均返回 `503 No available compatible accounts`，未产生输出，不记作采用源图或资产进展。

## 内容交付门禁

`release:check` 每次校验 `docs/contracts/graywake-shark-dcc-v1.json`。当前没有 `public/assets/models/graywake-shark.glb`，因此报告 `contentGates.sharkDcc=pending-dcc-delivery`；专用牙龈源图不存在，报告 `contentGates.sharkGingivaImage2=pending-image-2-source`。这两个 pending 不使仍使用已验收代码原生鲨体的技术候选失败，但 M9 不得据此转为完成。GLB 一旦出现，将自动检查 GLB 2.0 容器与 BIN/accessor 边界、1.6 MB/几何预算、变换后实际米制包围盒、节点/材质映射、单 skin、关节拓扑、inverse bind matrices 和精确七段动画集；失败会阻断候选。

## 包体证据

候选包共 `130` 个文件、`51,956,509` bytes，零 `.map` 文件、零 `sourceMappingURL`。硬预算与实测如下：

| 分段 | 实测 bytes | 上限 bytes |
| --- | ---: | ---: |
| 入口 JavaScript | 408,506 | 471,040 |
| 世界 JavaScript | 1,081,419 | 1,177,600 |
| Rapier JavaScript | 2,237,380 | 2,304,000 |
| 应用 CSS | 83,243 | 114,688 |
| 全候选包 | 51,956,509 | 54,525,952 |

大纹理图集属于质量预算，不通过删 normal、降低分辨率或退回占位材质换取包体通过。后续任何分段越界必须解释增长、拆分加载或重新制定预算，不能静默放宽阈值。

## 生产包生命周期

检查器用 Node 静态服务直接托管 `dist`，再复用 M1 浏览器回归：

1. 标题页确认无 Canvas、无世界 runtime resource；
2. 首次开始后等待稳定暂停页，继续后取得 Pointer Lock 与模拟所有权；
3. 完成真实跳跃、镜头设置切换和失焦/恢复；
4. 调用 WebGL `WEBGL_lose_context.loseContext()`，确认 Context 不健康、模拟停止、单 Canvas 保留且继续按钮禁用；
5. 调用同一扩展 `restoreContext()`，再次由玩家手势继续；
6. `0.22.15` 最终九个动态筏格对应九个 collider，模拟活动且 framebuffer 有效非空，外域资源请求与浏览器错误均为零。

本机为 `ANGLE / Mesa llvmpipe / OpenGL ES 3.2`。恢复测试会如实记录软件环境的固定步积压丢弃；这证明生产包能在真实浏览器扩展事件后恢复一致状态，不证明软件渲染达到实时性能。

## 生产包音频生命周期

检查器再用独立 Chromium 上下文从 `dist` 启动真实用户手势和 Web Audio 图：

1. `music / ambience / effects / creatures / ui` 与 master 六级控制、世界低通和母带压缩器必须全部就绪，`AudioContext.state=running`；
2. 压缩器参数必须为 `-10 dB / knee 5 / ratio 12:1 / attack 0.003s / release 0.2s`；
3. 失焦后 `focusMuted=true` 且平滑 master 目标为 `0`；恢复焦点并由继续手势取回模拟后目标回到偏好值 `0.78`；
4. 三态均不得出现页面或控制台错误。完整状态写入 `audio-mix-lifecycle.json` 与候选报告；四级提示让位的纯策略/时间线由 Vitest 锁定。

该门禁验证拓扑、参数和生命周期，不产生真实设备录音，也不用于宣称响度、HRTF、频响或主观混音通过。

## 外部门禁

- 真实桌面 GPU 的 1280x720/30 低档与 1920x1080/60 高档 profile，并各复跑 Context Lost/Restore；
- 两档各 1200 秒原生 rAF 长稳、Heap/纹理/几何/帧率/动态分辨率证据；
- 真实扬声器与耳机复核六总线、决策提示让位、水下低通、HRTF、峰值与泵音；
- 3 至 5 名无说明玩家完成 30 至 60 分钟前期流程；
- 项目所有者选择 Driftwake 原创代码与资产的发行许可，并完成商标/相似性法律复核；
- 在最终 CDN/静态主机复跑 HTTPS、MIME、缓存、根路径与 localStorage 来源隔离检查。
