# M6 钓鱼、烹饪与种植验收记录

> 当前状态：`DOING`（钓鱼子系统代码、自动交互与原创鱼体材质闭环完成；烹饪、种植和对应历史素材整改继续进行）
> 本次切片：三鱼种/三体型、差异化搏鱼、分份结算、容量边界、原创 PBR 鱼体与连续浏览器门禁
> 版本：`0.16.0`
> 日期：2026-07-20

## 多鱼种领域合同

- 新增银脊鱼、旗尾梭、琥鳍鲷三种原创鱼；每种鱼拥有独立显示名、稳定 ID、模型名、轮廓参数、基础重量、份数、拉力频率、拉力幅度和捕获声画参数；
- 小型、中型、大型三档体型同时改变模型尺度、重量、预计鱼段、搏鱼难度与结算文案，不以随机 UI 标签伪造差异；
- 九种鱼种/体型组合由确定性种子采样，测试覆盖同种不同体型的重量/份数单调性、跨物种拉力差异和相同种子的稳定输出；
- 鱼讯、刺鱼、张力增长、松线恢复、进度回退、断线和捕获继续使用固定步真值；拉力采样进入同一诊断与 HUD，不由动画回调决定结算；
- 三个鱼模型在加载期一次性创建并完成材质 shader 预热，运行中只切换当前模型可见性；连续捕获门禁要求 `visibleModels=1`，避免反复创建导致卡顿或残留鱼体；
- 捕获阶段隐藏浮标与鱼线，捕获展示结束后才回到待机；手中钓竿和世界鱼体所有权分离，截图中不再同时保留远处抛投物。

## 结算与背包边界

- 渔获首先按鱼种/体型计算预计份数，再通过统一背包容量投影接收；只对实际入包的捕获磨损鱼竿一次，并立即保存；
- 连续三轮在同一浏览器上下文完成：银脊鱼大型得到 2 份、旗尾梭中型得到 1 份、琥鳍鲷大型得到 2 份，库存 `0 -> 2 -> 3 -> 5`；
- 鱼竿耐久从 `55 -> 54 -> 53 -> 52`，每轮恰好一个磨损事件；三个模型均无重复实例、无失败结算或 WebGL Context 丢失；
- 部分容量场景从 `7/8` 开始捕获预计 2 份的大型银脊鱼，只接收 1 份，库存 `7 -> 8`、耐久 `10 -> 9`，通知明确说明另 1 份滑回海里；
- 满包场景从 `8/8` 开始，同一渔获整笔返海；库存保持 8、耐久保持 10、磨损事件保持 0，不会吞物、复制鱼段或消耗工具；
- 512x320 容量场景中搏鱼卡位于 `(310,100)-(494,249)`、快捷栏位于 y=`258-302`，无越界或相交。

## 拉力、交互与声音差异

- 连续门禁记录的拉力峰值为银脊鱼 `0.740`、旗尾梭 `0.815`、琥鳍鲷 `0.960`；琥鳍鲷的大型重拉窗口会真实迫使玩家松线，而不是只延长总时长；
- 三轮张力峰值分别为 `0.843 / 0.827 / 0.882`，自动验收在高张力主动松线、恢复后再收线，覆盖多次收放转换而非直接写入捕获阶段；
- HUD 同步显示鱼种、体型、重量、预计份数、当前拉力、张力和收线进度；1024x640 与 800x500 均通过搏鱼卡/快捷栏布局门禁；
- 抛投、入水、鱼讯、卷线、断线保持独立程序音层；搏鱼受物种拉力调制，捕获音按体型/份数改变低频重量与确认层，不复用一条完全相同的提示音；
- 页面内 MutationObserver 只在真实阶段边沿派发 Canvas 输入，且仍驱动正式固定步和张力状态；目标真实 GPU 复验时保留鼠标输入与主观手感门禁。

## 原创鱼体与材质门禁

- 银脊鱼、旗尾梭、琥鳍鲷使用平滑躯干、独立背鳍/胸鳍/尾鳍和种属比例；不是同一胶囊仅换颜色；
- 三种鱼皮和远洋鱼眼均由项目 `scripts/imagegen` 使用 `gpt-image-2`、`quality=high` 生成 2048x2048 原创源图；源 PNG 归档在 `artifacts/imagegen/`，仓库未保存 provider URL 或 API Key；
- 运行时使用五套 1024x1024 albedo/normal/roughness：三种鱼皮、鲜鱼肉和远洋鱼眼。每个鱼体诊断必须同时报告对应鱼皮三图与鱼眼三图；材质 URL 唯一性和关键绑定另有单元测试；
- 银脊鱼接缝为 x=`9.35/1.29x`、y=`11.31/1.14x`；琥鳍鲷为 x=`9.42/1.14x`、y=`6.86/1.20x`；旗尾梭采用拒绝宽处理带后的 48px 版本，为 x=`4.07/1.25x`、y=`14.32/1.12x`；
- 远洋鱼眼保留非平铺中心虹膜，径向亮度为 pupil=`2.0`、iris=`105.5`、edge=`3.9`；三种鱼捕获近景均检查瞳孔、虹膜、眼缘比例和朝向；
- `fishing-silver-spine-catch-desktop.png`、`fishing-sailtail-runner-catch-desktop.png`、`fishing-amber-fin-catch-desktop.png` 已人工复核：鱼种轮廓和色层可辨、没有残留鱼线/浮标、材质未回退为纯色、鱼体未被 HUD 裁切；
- 鲜鱼肉源图与 PBR 已通过数值/平铺门禁，但必须在基础烤架和三槽烤台的生/熟/焦场景完成后才可从 `IN_REVIEW` 转为 `APPROVED`。

## 自动与浏览器证据

- `npm test`：46 个测试文件、286 项测试通过；新增钓鱼领域 7 项、鱼体/材质结构和 URL 绑定测试，同时保持存档、建造、鲨鱼、设备、导航等既有覆盖；
- `npm run build` 通过：React 主入口约 350.43KB、3D 世界约 1.048MB、Rapier 约 2.237MB，继续保持独立 chunk；
- `npx tsc --noEmit`、`node --check scripts/capture.mjs`、`python -m py_compile scripts/prepare_imagegen_eye.py` 与 `git diff --check` 全部通过；构建阶段额外发现并补齐四个旧测试材质夹具，未把新增接口字段改成可选来绕过类型合同；
- `FISHING_STAGE=variety` 在同一上下文完成三轮，`visualsPrewarmed=true`、每轮 `visibleModels=1`、模型违规为 0、Context 始终健康；
- 捕获成片冻结前要求昼光不低于 `0.9` 且天气处于平静/消散阶段，避免把夜间不可读材质当作高质量通过；高画质捕获完成后恢复性能设置，不污染后续搏鱼；
- 软件 GLES 原生 `readPixels` 返回全零时，脚本只允许使用经过非空、尺寸和编码检查的浏览器合成帧作为构图证据；这不冒充目标真实 GPU 性能通过；
- 高画质琥鳍鲷近景为 1024x640、约 509KiB；银脊鱼与旗尾梭近景分别约 424KiB 与 470KiB，另保留旗尾梭真实搏鱼帧作为鱼线/浮标交互证据。

连续门禁结果摘要：

```text
species=3  rounds=3  inventory=0->2->3->5
rodDurability=55->54->53->52  wearEvents=3
pullMax=0.740/0.815/0.960  tensionMax=0.843/0.827/0.882
visibleModels=1/1/1  modelViolations=0  visualsPrewarmed=true
partial=7->8 durability=10->9 returned=1
full=8->8 durability=10->10 wearEvents=0
```

复现命令：

```sh
CAPTURE_ONLY=fishing FISHING_STAGE=variety CAPTURE_FAST=1 \
  DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=fishing FISHING_STAGE=capacity CAPTURE_FAST=1 \
  DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=fishing FISHING_STAGE=variety CAPTURE_QUALITY=high \
  FISHING_VISUAL_IDS=silver-spine,sailtail-runner,amber-fin \
  DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=fishing FISHING_STAGE=variety CAPTURE_QUALITY=high \
  FISHING_VISUAL_IDS=amber-fin FISHING_ROUND_LIMIT=3 FISHING_CAPTURE_FIGHT=0 \
  DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
```

## M6 剩余工作

- 收敛基础烤架、三槽烤台、共享燃料、24 秒收取窗口、焦鱼惩罚、生熟消费和净水维护链，并为鲜鱼肉取得生/熟/焦真实场景证据；
- 用 `gpt-image-2 high` 原创 PBR 替换基础烤架、净水器和三槽烤台触及的通用锈铁、聚合物、湿木与绳材质，未通过前不能把烹饪子系统标为完成；
- 补齐天气对作物需水/生长/枯萎的影响，收敛盐翼盗鸟压力与无说明玩家维护节奏；同步替换叶、果、羽毛、翼面和喙的纯色占位；
- 在目标真实 GPU 的 1280x720/30 与 1920x1080/60 下，用真实鼠标连续钓鱼至少 10 分钟，检查抛投时序、张力手感、鱼体 PBR、鱼线/浮标、HRTF/混音和运行时预算；
- 完成烹饪与种植后再判定 M6 总里程碑；本记录只关闭 `SYS-012`，不提前关闭 `SYS-013` 或 `SYS-022`。
