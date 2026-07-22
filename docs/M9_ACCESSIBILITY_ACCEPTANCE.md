# M9 无障碍输入验收记录

> 当前状态：`DONE`（代码、领域测试和软件浏览器门禁已闭环；真实 GPU、无说明玩家与完整辅助技术审阅仍属发布门禁）
> 本次切片：可重映射键位、关键声音字幕、色觉辅助、减少动态与设置键盘操作
> 版本：`0.22.0`
> 日期：2026-07-22

## 输入与偏好合同

- `driftwake.preferences.v3` 在原有音频、镜头和画质偏好外保存 18 项 `KeyboardEvent.code` 动作、字幕开关、色觉模式和减少动态开关。v1/v2 读取时安全补齐默认值。
- 动作包含四向移动、跳跃/上浮、下潜、交互、背包、制作、替代操作、建造件型、建造分类和六格工具栏。系统不再直接比对 `E/R/F/Q/WASD/Space/Tab/C`，而是消费同一运行时匹配器。
- 键位编辑拒绝抢占已有动作；按 `Escape` 取消捕获，恢复默认会重新建立完整唯一映射。旧 `I` 与右 `Ctrl` 只在没有重映射时保留为默认兼容别名。
- 键位、字幕、色觉与减少动态是用户偏好，不会随新航次、读档或失败恢复重置。

## 字幕与视觉合同

- 字幕默认关闭，可独立于音频开关启用。鲨鱼、雷声、生存、氧气、鱼讯/断线、工具/绳索、结构断裂以及失败/恢复等会影响决策的声音进入字幕轨；脚步和连续收绳等高频声不进入该轨。
- 字幕显示时长按文本长度限制在 `2.8-5.2s`，重复提示在短窗口内去重。失败和恢复在状态转变时同步发出字幕，不能被音频图初始化或静音开关阻断。
- 色觉辅助提供标准、红弱、绿弱、蓝弱与高对比模式，只替换 UI 语义色和高对比边界，不给海面、岛屿或原创贴图施加全局滤镜。
- 减少动态关闭界面动画/过渡，运行时使用舒适镜头档，并把受击镜头晃动缩放至 20%。
- 设置弹窗打开时将焦点置于关闭按钮；Tab 在弹窗内循环，Escape 关闭弹窗，窄屏保持可滚动且无横向溢出。

## 自动证据

```sh
npx vitest run src/game/domain/inputBindings.test.ts src/game/domain/preferences.test.ts src/game/systems/AudioSystem.test.ts src/state/gameStore.test.ts --maxWorkers=1
CAPTURE_ONLY=accessibility DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=accessibility-caption DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=accessibility-bindings CAPTURE_FAST=1 DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
```

- `inputBindings.test.ts` 覆盖完整唯一默认映射、损坏偏好回退、冲突拒绝、旧默认别名和键名呈现。
- `preferences.test.ts` 与 `gameStore.test.ts` 覆盖 v1/v2 迁移、新偏好清洗以及换档会话重置时保留用户偏好。
- `AudioSystem.test.ts` 确认尚未创建浏览器音频图时仍发布关键字幕，避免静音/自动播放策略让视觉提示消失。
- `accessibility` 在桌面和 `640x720` 下实际修改字幕、色觉和减少动态，捕获新键、验证冲突消息并恢复默认；无 Canvas 标题页仍保持延迟加载。
- `accessibility-caption` 以失败恢复路径触发真实恢复声音字幕，验证字幕不遮挡工具栏、减少动态写入运行时且有效镜头档为 `comfort`。
- `accessibility-bindings` 将前进由 `W` 改为 `T` 后，真实角色局部位移为 `0.898`，旧 `W` 位移为 `0`。

本轮全量 Vitest：50 个测试文件、320 项通过。生产构建、独立类型检查、捕获脚本和 Image 2 材质管线脚本均通过。Termux/Xvfb 只提供逻辑、行为与构图证据，不能替代目标真实 GPU、屏幕阅读器审阅或无说明玩家验收。

## 剩余发布门禁

- 真实 GPU 上的屏幕阅读器、键盘流与色觉模式人工审阅；
- 多语言文案、完整音频混音、灯光统一与历史材质整改；
- 真 WebGL Context Lost/Restore、双画质 profile、20 分钟长稳；
- 新玩家 30-60 分钟无说明流程与发布/许可证证据包。
