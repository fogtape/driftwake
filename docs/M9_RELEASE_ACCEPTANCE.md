# M9 候选发布与异常恢复验收

> 日期：2026-07-25
> 版本：`0.22.12`
> 状态：`APPROVED`（候选构建、资产来源、第三方许可、包体预算和生产包 Context 生命周期闭环；目标 GPU、20 分钟长稳、外部玩家与项目自身许可仍是外部门禁）

## 发布合同

```sh
npm ci
RELEASE_REQUIRE_CLEAN=1 npm run release:check
```

命令按顺序执行全量 Vitest、TypeScript 与 Vite `release` 构建、资产来源核对、生产依赖许可核对、包体预算和生产包浏览器生命周期门禁。任一阶段失败都会令命令非零退出，同时把失败阶段写入 `artifacts/release/latest.json`。

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

本切片没有新增或降级任何位图，因此没有触发新的 Image 2 采用；既有高质量运行时资产原样进入候选包。项目 `scripts/imagegen` 现将 SDK `Error code: 502/503/504` 识别为单次请求的可重试上游失败，纯 Python 回归与 `gpt-image-2 high 2048x2048` dry-run 通过；专用牙龈的一次有界请求三次均返回 upstream 502，未产生输出，不记作采用源图或资产进展。候选发布首次单线程运行暴露 `ProceduralModels` 的逐坐标 matcher 开销；测试仍扫描全部顶点，但聚合为一次失败断言，52/329 单线程基线恢复通过，不以放宽 timeout 掩盖问题。

## 包体证据

候选包共 `130` 个文件、`51,952,535` bytes，零 `.map` 文件、零 `sourceMappingURL`。硬预算与实测如下：

| 分段 | 实测 bytes | 上限 bytes |
| --- | ---: | ---: |
| 入口 JavaScript | 408,506 | 471,040 |
| 世界 JavaScript | 1,077,451 | 1,177,600 |
| Rapier JavaScript | 2,237,380 | 2,304,000 |
| 应用 CSS | 83,243 | 114,688 |
| 全候选包 | 51,952,535 | 54,525,952 |

大纹理图集属于质量预算，不通过删 normal、降低分辨率或退回占位材质换取包体通过。后续任何分段越界必须解释增长、拆分加载或重新制定预算，不能静默放宽阈值。

## 生产包生命周期

检查器用 Node 静态服务直接托管 `dist`，再复用 M1 浏览器回归：

1. 标题页确认无 Canvas、无世界 runtime resource；
2. 首次开始后等待稳定暂停页，继续后取得 Pointer Lock 与模拟所有权；
3. 完成真实跳跃、镜头设置切换和失焦/恢复；
4. 调用 WebGL `WEBGL_lose_context.loseContext()`，确认 Context 不健康、模拟停止、单 Canvas 保留且继续按钮禁用；
5. 调用同一扩展 `restoreContext()`，再次由玩家手势继续；
6. `0.22.12` 最终九个动态筏格对应九个 collider，模拟活动且 framebuffer 有效非空，外域资源请求与浏览器错误均为零。

本机为 `ANGLE / Mesa llvmpipe / OpenGL ES 3.2`。恢复测试会如实记录软件环境的固定步积压丢弃；这证明生产包能在真实浏览器扩展事件后恢复一致状态，不证明软件渲染达到实时性能。

## 外部门禁

- 真实桌面 GPU 的 1280x720/30 低档与 1920x1080/60 高档 profile，并各复跑 Context Lost/Restore；
- 两档各 1200 秒原生 rAF 长稳、Heap/纹理/几何/帧率/动态分辨率证据；
- 3 至 5 名无说明玩家完成 30 至 60 分钟前期流程；
- 项目所有者选择 Driftwake 原创代码与资产的发行许可，并完成商标/相似性法律复核；
- 在最终 CDN/静态主机复跑 HTTPS、MIME、缓存、根路径与 localStorage 来源隔离检查。
