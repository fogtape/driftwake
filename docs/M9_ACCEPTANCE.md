# M9 完整性、存档与发布质量验收记录

> 当前状态：`DOING`（三档存档、备份恢复、生命周期保存、无障碍输入与首批工具/打捞历史材质已闭环；其余最终资产、真实 GPU 与发布证据仍在后续切片）
> 本次切片：三航次档位、同槽备份、损坏隔离、旧单档迁移与标题页恢复状态
> 版本：`0.21.0`
> 日期：2026-07-22

## 存档仓库合同

- 世界领域结构仍保持 `v18`。多档位是存储仓库升级，不伪造新的世界 schema，也不放松既有 v1-v17 迁移和 sanitize 约束。
- 固定三档：`slot-1`、`slot-2`、`slot-3`。每档拥有独立主档 `driftwake.save.<slot>.v18` 与独立备份 `driftwake.save.<slot>.backup.v18`；活动档由 `driftwake.save.active.v1`、兼容工作副本所属档由 `driftwake.save.working-slot.v1` 记录。
- 旧版 `driftwake.save.v18` 及 v1-v17 首次进入时只物化到一号档。活动档继续镜像该工作副本，保留既有 capture、冷启动和外部诊断兼容；二、三号档永不写入该别名。
- 写入顺序为：清洗待写状态、验证上一有效主档/工作副本、写入并回读备份、写入并回读新主档、最后尽力更新活动工作副本。主档写失败时不会丢失可恢复副本。
- 读取顺序为活动工作副本与主档的最新有效版本、同槽备份、旧单档迁移。未标记的旧工作副本只允许归属一号档；主档损坏时在同槽工作副本与备份间选择较新的有效版本，一号与二、三号档不会互相降级或复制。
- 标题页在动态导入 Three.js/Rapier 前展示航行时长、筏格数、失败、备份可恢复和不可恢复损坏状态。选择空档开始新航次，选择损坏档会清理该档后重建；删除操作只影响选中档及其兼容键。
- `DriftwakeGame` 构造时锁定活动档位。初始化前重置玩法会话但保留偏好，成功后立即建立检查点；12 秒自动保存、`beforeunload`、`pagehide`、页面隐藏和 Context Lost 均同步保存。

## 自动证据

```sh
npx vitest run src/game/domain/save.test.ts src/game/domain/saveRepository.test.ts src/state/gameStore.test.ts --maxWorkers=1
CAPTURE_ONLY=save-slots DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=save-recovery CAPTURE_FAST=1 DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
```

- `saveRepository.test.ts` 覆盖旧单档物化、三档隔离、备份轮换、主档与工作副本同时损坏后的恢复、浏览器工作副本兼容、写失败保留可恢复副本、未标记旧别名的跨档隔离、主档损坏时的较新备份优先、活动二号档不误复制到一号档，以及逐档删除。
- `gameStore.test.ts` 覆盖档位切换前的玩法会话重置，同时保留音频、画质与动态分辨率偏好。
- `save-slots` 预置一号正常、二号主档损坏/备份有效、三号不可恢复损坏。桌面 `1440x900` 与窄屏 `640x720` 均验证三种状态、档位选择、按钮语义、无横向溢出和无 Canvas/世界 chunk。
- `save-recovery` 实际进入二号备份航次，确认 `slot-2` 被锁定、恢复标记为真、二号主档重写为 v18、一号仍为 `4260s`、备份为 `1560s`，并验证 synthetic `pagehide` 将上一个主档轮换为备份且钩具为唯一手持状态。

本轮全量 Vitest：49 个测试文件、314 项通过。Termux/Xvfb 仅用于逻辑、行为和构图证据；真实 GPU 的双 profile、长期运行、音频输出和无说明玩家流程不以此通过。

## 后续发布门禁

- 多语言文案与剩余辅助技术验收；无障碍输入、字幕、色觉与减少动态详见 [M9 无障碍验收记录](M9_ACCESSIBILITY_ACCEPTANCE.md)；
- 全流程混音、灯光、其余历史材质回溯和最终 DCC 替换；工具/打捞首批整改详见 [M9 材质整改验收记录](M9_MATERIAL_ACCEPTANCE.md)；
- 真 WebGL Context Lost/Restore、真实 GPU 1280x720/30 与 1920x1080/60、20 分钟长稳；
- 新玩家 30-60 分钟无说明流程、存档选择理解、删除确认理解和恢复信任度。
