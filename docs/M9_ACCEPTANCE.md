# M9 完整性、存档与发布质量验收记录

> 当前状态：`DOING`（三档存档、备份恢复、生命周期保存、无障碍输入、情境化早期引导、候选发布构建与真实 Context 生命周期、全流程母带/决策提示混音，以及七批历史材质和代码原生 24 齿口腔 rig 已闭环；最终 DCC 的机器合同与验证器已就绪，专用牙龈源图、最终可蒙皮资产、目标 GPU、长稳与外部玩家证据仍在后续切片）
> 当前版本：`0.22.15`
> 日期：2026-07-25

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
- 在既有 1.85m 吻部停距、木筏 3.6m / 水中 3.85m 攻击中心基础上，代码原生 oral rig v1 现在提供上颌 13、下颌 11 颗主/次两层牙齿、牙龈带、开口内腔和阶段驱动下颌；水中真实活动帧为 `34 / 118 / 47 / 99,830`、`variation=253 / nonBlack=233,682`、`teeth=24`、`jawOpen=0.512`、眼/牙焦点 `0.962/0.977`，正式咬筏继续锁定 `32/32`、`jawOpen=0.439` 与牙焦点 `0.931`。专用牙龈 PBR 的四次 `gpt-image-2 high 2048x2048` 请求均无输出，当前独立 `sharkGum` 材质透明复用已批准 TEX-050 区域；最终可蒙皮 DCC 鲨齿/牙龈/口腔层仍为单独发布门禁。详细证据见 [M9 生物微材质验收记录](M9_CREATURE_MATERIAL_ACCEPTANCE.md)。
- `0.22.15` 将牙龈最终提示词固化到 `docs/prompts/`，同规格 dry-run 通过后正式请求三次均返回 `503 No available compatible accounts`，仍为零输出；同时新增 [深潮鲨 DCC v1 合同](M9_DCC_SHARK_CONTRACT.md)、GLB 解析/验证 CLI 和合格/反例测试，锁定实际几何坐标/比例、BIN/accessor、包体、节点、材质、单 skin、骨骼、精确动画集与运行时重映射。合同 `READY` 不等于资产完成，候选报告分别保留 `pending-image-2-source` 与 `pending-dcc-delivery`。
- 水面割取在仍按住交互键时允许几何焦点或输入门禁短暂抖动：进度暂停并在重新对准后续接，只有松键、窗口失焦、拒收或下沉才清零；320x200 软件逻辑档真实结算四段战利品，1024x640 软件 GLES Context Lost 则明确保留为目标 GPU 门禁，不以降低素材质量换取通过。

## 情境化早期引导闭环

- 新航次目标由当前背包、饥渴、净水器状态和筏格数实时推导，不新增教程标记或存档迁移；
- 目标序列覆盖净水器材料、部署、容器/燃料、冷凝、收取、建造锤和首块扩筏；资源数量直接复用物品短名，已有淡水不会重复卡在容器阶段；
- 口渴/饥饿且有补给时临时优先提示供给；鲨鱼、风暴、入水、上岛和首块扩筏完成后目标卡让位或退出；
- `onboarding` 浏览器门禁验证 1024x640 新航次/冷凝态和 640x720 窄视口，目标卡与岛屿栏、航向栏、右上控制均无交叠；完整证据见 [M9 情境化早期航程引导验收](M9_ONBOARDING_ACCEPTANCE.md)。

## 钓鱼与漂流物微材质闭环

- 钓鱼浮漂主体/顶帽和聚合漂流物瓶盖移除局部纯色材质，改为克隆已批准 TEX-024 盐蚀聚合物的 albedo、normal、roughness；奶油、珊瑚和黄铜色调只服务于远海可见性，不绕过 PBR；
- 浮漂诊断公开两组 `salt-etched-polymer-albedo|normal|roughness`；模型测试禁止三件表面直接共享可变源材质，浏览器门禁在抛投、鱼讯、咬钩、拉力与结算间持续验证该签名；
- `FISHING_CAPTURE_BOBBER=1` 只冻结游戏时钟，不打开设置或丢失 Pointer Lock。`1024x640` 证据帧显示钓线、浮漂、风暴海况和 HUD 同时有效，随后同一轮正常结算 `2` 鲜鱼段、钓竿 `54` 耐久。

## 候选发布与异常恢复闭环

- `release` 模式不携带 sourcemap；Barlow Condensed 与 Manrope 只打包实际需要的 Latin 子集，主 CSS 从约 106 KB 降至 83,243 bytes；
- 发布检查递归读取 `package-lock.json`，九个生产依赖必须与结构化 SPDX/来源/许可文本清单完全一致；候选包生成完整 `THIRD_PARTY_NOTICES.txt`；
- 113 个运行时资产、45 个采用 `-raw.png` 源图和 28 条显式运行时路径均通过来源门禁，无缺失或未登记文件；
- 项目 `scripts/imagegen` 对单次 `generate` / `edit` 的已知传输失败增加有界退避，默认 3 次且不重放批量、参数或文件错误；`0.22.12` 补齐 OpenAI SDK `Error code: 502/503/504` 格式。专用牙龈的一次有界请求实际完成三次调用、均为 upstream 502，未产生新源图，也没有改变专用牙龈/DCC 发布门禁；
- 候选包 130 个文件、51,956,509 bytes，每个文件写入 SHA-256 清单；入口、世界、Rapier 与 CSS 分别为 `408,506 / 1,081,419 / 2,237,380 / 83,243` bytes；
- 从 `dist` 静态服务验证标题页无 Canvas/世界 chunk，进入世界后使用真实 `WEBGL_lose_context` 扩展丢失并恢复同一上下文；恢复后模拟、九块筏格碰撞和有效画面全部回归，外域资源请求为零；
- 本机 renderer 为 llvmpipe，真实恢复耗时约 229.6 秒与 51.853 秒模拟积压丢弃只记录为软件正确性证据，不用于宣称目标 GPU 性能。完整合同见 [M9 候选发布与异常恢复验收](M9_RELEASE_ACCEPTANCE.md)。

## 全流程混音与母带安全闭环

- 世界四总线继续先经过水下低通，UI 保持直达主增益；汇合后的总输出新增 `-10 dB / 12:1 / 3 ms attack / 200 ms release` 压缩器，防止风暴、鲨鱼、结构和 UI 瞬态叠加削波；
- 鱼讯/信号、断线/警报、氧气/鲨鱼蓄势/咬击和失败按四级只暂降环境与音乐，效果、生态和 UI 提示本身保持可读；重叠提示直接重排 Web Audio 参数时间线，只允许同级延长或更高等级抢占，不依赖页面定时器；
- `test:audio-mix` 在 1024x640 真实 Chromium 用户手势后验证六总线图和压缩器运行；失焦主增益目标为 `0`，继续后恢复 `0.78`，两态图均保持就绪且零浏览器错误；
- 同一探针已加入 `release:check` 并从生产 `dist` 独立复跑。它只证明图拓扑和状态正确，不替代真实扬声器/耳机听感。完整合同见 [M9 全流程混音与母带安全验收](M9_AUDIO_MIX_ACCEPTANCE.md)。

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
CAPTURE_ONLY=fishing FISHING_STAGE=variety CAPTURE_FAST=1 FISHING_ROUND_LIMIT=1 FISHING_CAPTURE_BOBBER=1 npm run capture
npm run test:audio-mix
RELEASE_REQUIRE_CLEAN=1 npm run release:check
```

- `saveRepository.test.ts` 覆盖旧单档物化、三档隔离、备份轮换、主档与工作副本同时损坏后的恢复、浏览器工作副本兼容、写失败保留可恢复副本、未标记旧别名的跨档隔离、主档损坏时的较新备份优先、活动二号档不误复制到一号档，以及逐档删除。
- `gameStore.test.ts` 覆盖档位切换前的玩法会话重置，同时保留音频、画质与动态分辨率偏好。
- `save-slots` 预置一号正常、二号主档损坏/备份有效、三号不可恢复损坏。桌面 `1440x900` 与窄屏 `640x720` 均验证三种状态、档位选择、按钮语义、无横向溢出和无 Canvas/世界 chunk。
- `save-recovery` 实际进入二号备份航次，确认 `slot-2` 被锁定、恢复标记为真、二号主档重写为 v18、一号仍为 `4260s`、备份为 `1560s`，并验证 synthetic `pagehide` 将上一个主档轮换为备份且钩具为唯一手持状态。

`ProceduralModels.test.ts` 保持对每个模型顶点的完整有限值扫描，但将逐坐标 matcher 聚合为一次失败断言，避免单线程候选发布下的测试框架开销超时；该文件从约 16.7 秒降至 0.4 秒。`0.22.14` 的候选发布检查得到 53 个测试文件、334 项通过、113 个运行时资产、45 个采用源、9 个生产依赖和 51,956,509-byte 候选包；生产 Context 恢复后保持 9/9 collider、有效非空 framebuffer、零外域资源和浏览器错误，独立音频页保持六总线/压缩器运行及失焦目标 `0`、恢复目标 `0.78`。Termux/Xvfb 仅用于逻辑、行为、构图、音频图和异常恢复正确性证据；真实 GPU 的双 profile、20 分钟长稳、真实音频输出和无说明玩家流程不以此通过。

`0.22.15` 增加五项 DCC 合同/GLB 验证回归后，完整候选发布检查为 54 个测试文件、339 项通过；资产与包体保持 113 个运行时资产、45 个采用源、9 个生产依赖、130 个文件和 51,956,509 bytes。生产标题页延迟加载、Context 恢复后的 9/9 collider 与有效 framebuffer、独立音频图的失焦归零/恢复 `0.78`、零外域请求和零浏览器错误继续通过；内容报告如实保留 `pending-dcc-delivery` 与 `pending-image-2-source`。

## 后续发布门禁

- 多语言文案与剩余辅助技术验收；无障碍输入、字幕、色觉与减少动态详见 [M9 无障碍验收记录](M9_ACCESSIBILITY_ACCEPTANCE.md)；
- 真实设备混音、灯光、其余历史材质回溯和最终 DCC 替换；自动混音闭环见 [M9 全流程混音与母带安全验收](M9_AUDIO_MIX_ACCEPTANCE.md)，工具/打捞整改详见 [M9 材质整改验收记录](M9_MATERIAL_ACCEPTANCE.md)，岛屿/岸上整改详见 [M9 岛屿材质验收记录](M9_ISLAND_MATERIAL_ACCEPTANCE.md)，水下礁区整改详见 [M9 水下材质验收记录](M9_UNDERWATER_MATERIAL_ACCEPTANCE.md)，结构/防御整改详见 [M9 结构与防御材质验收记录](M9_STRUCTURE_MATERIAL_ACCEPTANCE.md)，鲨鱼微材质详见 [M9 生物微材质验收记录](M9_CREATURE_MATERIAL_ACCEPTANCE.md)；
- 目标真实 GPU 重复 Context Lost/Restore、1280x720/30 与 1920x1080/60 双 profile、20 分钟长稳；
- 项目所有者明确 Driftwake 原创代码/资产的发布许可，并在实际托管目标复跑静态路由、缓存与 HTTPS 部署检查；
- 新玩家 30-60 分钟无说明流程、存档选择理解、删除确认理解和恢复信任度。
