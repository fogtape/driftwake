# M9 完整性、存档与发布质量验收记录

> 当前状态：`DOING`（三档存档、备份恢复、生命周期保存、无障碍输入、情境化早期引导，以及工具/打捞、岛屿/岸上、水下礁区、结构/防御、鲨鱼口腔/眼部/主体皮肤和代码原生牙釉牙列七批历史材质已闭环；最终可蒙皮 DCC 口腔/牙齿、真实 GPU 与发布证据仍在后续切片）
> 当前版本：`0.22.8`
> 日期：2026-07-24

## 存档仓库合同

- 世界领域结构仍保持 `v18`。多档位是存储仓库升级，不伪造新的世界 schema，也不放松既有 v1-v17 迁移和 sanitize 约束。
- 固定三档：`slot-1`、`slot-2`、`slot-3`。每档拥有独立主档 `driftwake.save.<slot>.v18` 与独立备份 `driftwake.save.<slot>.backup.v18`；活动档由 `driftwake.save.active.v1`、兼容工作副本所属档由 `driftwake.save.working-slot.v1` 记录。
- 旧版 `driftwake.save.v18` 及 v1-v17 首次进入时只物化到一号档。活动档继续镜像该工作副本，保留既有 capture、冷启动和外部诊断兼容；二、三号档永不写入该别名。
- 写入顺序为：清洗待写状态、验证上一有效主档/工作副本、写入并回读备份、写入并回读新主档、最后尽力更新活动工作副本。主档写失败时不会丢失可恢复副本。
- 读取顺序为活动工作副本与主档的最新有效版本、同槽备份、旧单档迁移。未标记的旧工作副本只允许归属一号档；主档损坏时在同槽工作副本与备份间选择较新的有效版本，一号与二、三号档不会互相降级或复制。
- 标题页在动态导入 Three.js/Rapier 前展示航行时长、筏格数、失败、备份可恢复和不可恢复损坏状态。选择空档开始新航次，选择损坏档会清理该档后重建；删除操作只影响选中档及其兼容键。
- `DriftwakeGame` 构造时锁定活动档位。初始化前重置玩法会话但保留偏好，成功后立即建立检查点；12 秒自动保存、`beforeunload`、`pagehide`、页面隐藏和 Context Lost 均同步保存。

## 结构与防御材质闭环

- 新增风暴撑紧固合金和风暴伤雪松横截面两套 `gpt-image-2 high 2048x2048` 原创源图；采用源、完整提示词、拒绝候选和 PBR 参数均已归档；
- 临界结构会缩短真实木质分件并露出横截面；冷启动保持断面，三锤修复后断面批次归零，结构生命、材料、耐久和 v18 保存保持同一事务；
- 工具钢、导航合金、结构新材质、七套水下材质与鲨鱼微材质共用 4096x4096 双图集；每区仍保留 960 核心，结构/周界历史场景均为 `30/32`、水下历史回归为 `29/32`，正式鲨鱼咬筏为 `32/32`，没有抬高硬预算；
- 详细来源、运行时槽位、三场 framebuffer 和复现命令见 [M9 结构与防御材质验收记录](M9_STRUCTURE_MATERIAL_ACCEPTANCE.md)。

## 深潮鲨微材质闭环

- 新增深潮鲨口缘/鳃衬、圆瞳侧眼、主体皮肤与牙釉四套 `gpt-image-2 high 2048x2048` 原创源图；裂瞳、五个鲨皮候选和一版带宽水平明度带的牙釉候选明确拒绝，完整提示词、采用/拒绝源与 PBR 参数均归档；
- 眼、口、伤痕/鲨肉与牙釉使用四个独立 atlas 区域；共享图集保持 4096x4096/15 区与 960 核心，采用 F 鲨皮以 direct packed RGB/A + normal 运行，牙釉只占既有图集空格，正式咬筏仍为 `32/32`；
- 修复鲨体根节点正 Z `lookAt` 与负 Z 鼻端相反造成的尾朝目标问题；巡游、追击、扑咬、退场和浮尸共用正确朝向，眼口在真实袭击中不再被整段躯体遮挡；
- 攻击中心停距按 1.85m 吻部调整为木筏 3.6m、水中 3.85m，反击窗不再贴近裁剪面；采用 F 与 TEX-052 的水中微材质场景在真实活动帧得到 `34 / 115 / 43 / 96,354`、`variation=253 / nonBlack=232,772`、`teeth=9` 与牙焦点 `0.982` 后才冻结，正式咬筏继续锁定 `32/32` 与牙焦点 `0.941`。最终可蒙皮 DCC 鲨齿/口腔层仍为单独发布门禁。详细证据见 [M9 生物微材质验收记录](M9_CREATURE_MATERIAL_ACCEPTANCE.md)。
- 水面割取在仍按住交互键时允许几何焦点或输入门禁短暂抖动：进度暂停并在重新对准后续接，只有松键、窗口失焦、拒收或下沉才清零；320x200 软件逻辑档真实结算四段战利品，1024x640 软件 GLES Context Lost 则明确保留为目标 GPU 门禁，不以降低素材质量换取通过。

## 情境化早期引导闭环

- 新航次目标由当前背包、饥渴、净水器状态和筏格数实时推导，不新增教程标记或存档迁移；
- 目标序列覆盖净水器材料、部署、容器/燃料、冷凝、收取、建造锤和首块扩筏；资源数量直接复用物品短名，已有淡水不会重复卡在容器阶段；
- 口渴/饥饿且有补给时临时优先提示供给；鲨鱼、风暴、入水、上岛和首块扩筏完成后目标卡让位或退出；
- `onboarding` 浏览器门禁验证 1024x640 新航次/冷凝态和 640x720 窄视口，目标卡与岛屿栏、航向栏、右上控制均无交叠；完整证据见 [M9 情境化早期航程引导验收](M9_ONBOARDING_ACCEPTANCE.md)。

## 自动证据

```sh
npx vitest run src/game/domain/save.test.ts src/game/domain/saveRepository.test.ts src/state/gameStore.test.ts --maxWorkers=1
CAPTURE_ONLY=save-slots DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=save-recovery CAPTURE_FAST=1 DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=onboarding CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=shark-facial-materials CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=shark-combat SHARK_COMBAT_STAGE=visual CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=shark-loot-water CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=underwater CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=building BUILDING_PART=damage CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=perimeter-defense-visual CAPTURE_FAST=1 npm run capture
```

- `saveRepository.test.ts` 覆盖旧单档物化、三档隔离、备份轮换、主档与工作副本同时损坏后的恢复、浏览器工作副本兼容、写失败保留可恢复副本、未标记旧别名的跨档隔离、主档损坏时的较新备份优先、活动二号档不误复制到一号档，以及逐档删除。
- `gameStore.test.ts` 覆盖档位切换前的玩法会话重置，同时保留音频、画质与动态分辨率偏好。
- `save-slots` 预置一号正常、二号主档损坏/备份有效、三号不可恢复损坏。桌面 `1440x900` 与窄屏 `640x720` 均验证三种状态、档位选择、按钮语义、无横向溢出和无 Canvas/世界 chunk。
- `save-recovery` 实际进入二号备份航次，确认 `slot-2` 被锁定、恢复标记为真、二号主档重写为 v18、一号仍为 `4260s`、备份为 `1560s`，并验证 synthetic `pagehide` 将上一个主档轮换为备份且钩具为唯一手持状态。

当前全量 Vitest：51 个测试文件、326 项通过；生产构建、捕获脚本和 Image 2 PBR 派生脚本均通过。Termux/Xvfb 仅用于逻辑、行为和构图证据；真实 GPU 的双 profile、长期运行、音频输出和无说明玩家流程不以此通过。

## 后续发布门禁

- 多语言文案与剩余辅助技术验收；无障碍输入、字幕、色觉与减少动态详见 [M9 无障碍验收记录](M9_ACCESSIBILITY_ACCEPTANCE.md)；
- 全流程混音、灯光、其余历史材质回溯和最终 DCC 替换；工具/打捞整改详见 [M9 材质整改验收记录](M9_MATERIAL_ACCEPTANCE.md)，岛屿/岸上整改详见 [M9 岛屿材质验收记录](M9_ISLAND_MATERIAL_ACCEPTANCE.md)，水下礁区整改详见 [M9 水下材质验收记录](M9_UNDERWATER_MATERIAL_ACCEPTANCE.md)，结构/防御整改详见 [M9 结构与防御材质验收记录](M9_STRUCTURE_MATERIAL_ACCEPTANCE.md)，鲨鱼微材质详见 [M9 生物微材质验收记录](M9_CREATURE_MATERIAL_ACCEPTANCE.md)；
- 真 WebGL Context Lost/Restore、真实 GPU 1280x720/30 与 1920x1080/60、20 分钟长稳；
- 新玩家 30-60 分钟无说明流程、存档选择理解、删除确认理解和恢复信任度。
