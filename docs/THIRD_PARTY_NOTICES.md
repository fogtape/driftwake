# 第三方运行时依赖清单

> 状态：候选发布构建自动校验

Driftwake 的模型、贴图、动画与程序音频来源见 [原创资产清单](ASSET_MANIFEST.md)。以下只列入会进入浏览器候选包的第三方代码与字体；测试、构建和截图工具不进入运行时通知。

| 依赖 | 许可 | 用途 |
| --- | --- | --- |
| `@dimforge/rapier3d-compat` | Apache-2.0 | 3D 物理与碰撞 |
| `@fontsource/barlow-condensed` | OFL-1.1 | 标题与紧凑数据显示字体 |
| `@fontsource/manrope` | OFL-1.1 | 界面字体 |
| `lucide-react` | ISC | 界面图标 |
| `react`、`react-dom`、`scheduler` | MIT | 界面运行时与调度 |
| `three` | MIT | WebGL 场景与渲染 |
| `zustand` | MIT | 应用状态 |

机器真值位于 `release/runtime-dependencies.json`。`npm run release:check` 会从 `package-lock.json` 递归计算生产依赖，拒绝漏项、陈旧项、SPDX 不一致、非 HTTPS 来源或缺失许可文本；随后把各已安装包的完整许可文本与准确锁定版本写入候选包根目录 `THIRD_PARTY_NOTICES.txt`。

这份依赖清单不替代项目自身发布许可选择、商标检查或法律意见。项目所有者仍需在公开发布前明确 Driftwake 原创代码和资产的发行条款。
