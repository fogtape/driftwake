# Driftwake

原创桌面网页 3D 海上生存游戏。当前版本为 `0.22.1` 高质量纵向切片，不以基础 Demo 为完成标准。

## 当前内容

- Three.js 程序化海面、天空、雾、昼光、随波木筏和可接近的高度场岛屿；
- 统一 60 Hz 固定步模拟、渲染插值、失焦/隐藏/WebGL Context 生命周期门禁，以及可诊断的积压丢弃保护；
- 完整昼夜环境采样、木筏水平参考系、跳跃/落地状态机、三档镜头舒适度和运行时动态分辨率；
- 玩家首次开始后才延迟加载 Three.js/Rapier 世界；初始化完成会先进入稳定暂停画面，再由“继续漂流”申请鼠标锁；
- 第一人称移动、盐封帆布双手抓握、蓄力/放绳/受力收绳、19 点张力曲线、水花、五类漂流物、补给箱/桶战利品，以及带世界聚焦环的近距离手拾取；
- 打捞钩拥有 48 次抛投耐久，断裂会真实移除工具；背包拒收的战利品保留为池化海面掉落，并可通过近拾材料制作替代钩恢复；
- 建造锤只在扩建/修补/拆除成功后磨损，矛只在鲨鱼命中后磨损，潮鸣震叉只在成功脉冲后扣除电池和耐久，钓竿只在渔获实际入包后磨损，石/金属斧只在棕榈有效受击后磨损；最后一次动作仍生效，断裂会分层反馈、自动换工具并立即存档；
- 数据驱动的 53 类物品、20 格堆叠背包和 30 项便携配方；制作支持数量步进、八项顺序队列、逐项备料、取消完整返还、满包产出等待、研究门禁与工具唯一性；
- 生存压力使用稳定/偏低/危险/耗尽四档统一判定；低值 HUD 显示数值并有限脉冲，阈值跨越播放缺水/饥饿音层，饮水与进食反馈实际增减且成功后立即存档；满状态补给不会被误耗；
- 溺水、脱水、饥饿、鲨鱼和一般伤势会进入统一失败流程；工具与基础补给受保护，部分非工具物资在动态木筏右舷生成可重新打捞的回收包；
- 全屏失败页显示原因、实际散落清单、保留项和恢复数值；恢复会清空移动/跳跃/水流/镜头临时状态并回到筏面中央，再进入稳定暂停页；
- 可寻址木筏筏格、邻接建造、幽灵预览、材料校验、修补、拆除与连通性保护；建造锤把八件建造件整理为筏体/框架/层面三类两级选择，支持点击、分类前后切换、全局滚轮换件、分类内选择记忆，以及切工具取消预览后无损恢复；兼容槽位可原位替换，稳定 ID、承重链、材料净额、锤耐久、音画和存档在同一事务中提交；
- 六类原创结构使用分件装配与最多七个实例批次渲染；共享边、格内、楼面占位和承重拓扑统一校验，板门可在世界中开合并参与玩家碰撞，拆除或鲨鱼咬毁筏格会阻止或级联清除失去支撑的结构；
- 六类结构拥有独立生命、完整/受损/临界三档材质与确定性松动变形；深潮鲨会从外沿选择暴露结构并优先追击弱点，撕咬、碎屑、空间断裂音、拓扑坍塌和当前 v18 写入共享同一事务；失去支撑的结构继续以复用原分件/材质的双块实体翻滚落海，触发泡沫、木屑、空间落水声后下沉回收，瞬态过程不污染存档；
- 建造锤新增第八件潮铸筏缘护甲：只能初装在健康外围筏格，原创盐蚀合金导轨、锈蚀角片和铆固件随动态筏体运动；护甲让承托筏格、同格暴露结构和边挂收集网承受的鲨鱼伤害降低 55%，可单独拆卸返料且普通拆基础不会误吞金属；
- 建造锤命中受损结构时进入专用修补态，HUD 显示结构生命、百分比和按材质区分的实际成本；成功修补才扣料、播放分层修复音画、磨损锤具并立即保存；
- 楼梯提供与旋转方向一致的连续坡面，玩家可真实上下层；基础筏格、楼梯、上层地板和斜顶共享多表面采样，楼板/斜顶底面按真实厚度阻挡上跳并保留四向楼梯入口，支持上层墙/门/柱碰撞、离边坠落、上层跳跃落地和冷启动位置恢复；
- 可制作的潮兜收集网使用独立筏缘占位与原创盐蚀木框、悬垂绳格、浮子和装载物模型；只截获未被钩住的漂流物，12 件容量支持部分接收、靠近收取、满载 HUD、鲨鱼择靶/分段磨损、持锤 E 修补、锤拆原子返还，以及毁坏或失托后的物资落海；
- 浮标抛投、鱼讯窗口、张力/收线对抗、断线，以及银脊鱼、旗尾梭、琥鳍鲷三种原创鱼的独立轮廓、三档体型/重量/份数、差异化拉力、捕获展示和容量安全结算；
- 基础潮汐净水器与折铁烤架包含杯具回收、木材燃料、蒸馏、烤制、收取和过烧；
- 研究后可建造无需燃料、五杯并行的潮镜净水器，三份食物独立火候、共享燃料的三槽烤台，以及支持容量预判、任意数量拆分、双击整组和鼠标拖放的八格密封干舱；
- 设备附着筏格、玩家碰撞、拆解返还、随筏格落海、状态 HUD 和独立火焰/蒸汽/食物动画；
- 可制作的潮生作物盆，包含共享筏格占位、播种、两阶段浇水、缺水停长、枯萎清理、成熟收获和杯具返还；积云强风会提高蒸腾，风暴雨会补水但降低生长速度，余雨阶段平滑恢复；
- 原创盐翼盗鸟会盘旋、俯冲并啄食作物，玩家可在世界中驱赶；鸟害按停留时间削减果实但保留种子循环，强风暴会中断来访并驱散场上盗鸟；
- 可放置的盐迹研究台：消耗一份实物样本建档，15 项项目按炉工基础、筏上工业、远海测向三阶段组织；样本与项目前置共同控制推演，伪造高级项目会在载入时被依赖闭包清理；
- 潮红湿砖可在同一通风架分批放置、独立计时与收取；回潮熔炉可在矿石炼锭与细砂熔制玻璃之间切换；
- 金属锭研究会解锁潮铸穿浪矛和宽刃斧；升级消耗旧工具、自动替换快捷栏，并实际提升鲨鱼刺击与砍伐效率；
- 信号板、潮铸合金与密封铰链可研究潮鸣震叉；按住左键 1.25 秒后在 7.4m 定向锁定内松开，以 1 枚盐差电池和 1 点耐久换取轻伤害与立即驱离；提前松开、缺电或失锁不消耗资源；
- 原创程序深潮鲨拥有巡游、预兆、筏体/结构/网具择靶、水中扑咬、分级矛具命中与驱离；每轮攻击使用明确的蓄势/咬合/回摆阶段与最多两次结算，矛具在青色窗口起手可用完整前摇打断攻击，扑空、反击和普通命中具有独立声画反馈；致命刺击后会侧翻成 52 秒可采集鲨体，按住 `E` 依次割取 3 份鲨肉、1 张鲨皮和 2 枚鲨齿；
- 鲨体取尽或超时后持续下沉并进入 48 秒重生冷却；满包拒收物资使用专用捆扎模型进入既有八槽海面掉落池，部分接收不会复制或吞物，水中连续鲨咬的击退速度有界；连续三轮真实击杀/采集门禁覆盖失焦冻结、落水等待、自然重生定位、渲染预算、资源池合并和冷启动恢复；
- 岛屿远景接近、靠岸、无切场登岛、地形坡度与障碍碰撞、返筏后离流和下一岛重生；
- 18 个确定性岛屿资源节点、石斧三击/金属斧两击砍伐、树木受击/倒伏/树桩、枝料/石料/潮果/纤维拾取和满包保护；
- 木筏/岛屿/水域三表面移动、上下潜、自动登筏/上岸、潜深和氧气/溺水状态；
- 18 个确定性浅礁节点、细砂/黏土/金属矿三段钩击、海草收割、满包保护、节点动画和远征进度；
- 动态水下雾色、曝光、双面海面、滚动焦散、气泡/悬浮物、礁石/珊瑚/海草/鱼群与独立 PBR 海床材质；
- 深潮鲨会在玩家入水后切换目标、追击、扑咬、扣血和击退，水中木矛可命中并驱离；
- 可制作并占用筏格的拾风帆、潮石锚与定潮舵台，包含边缘放置、筏格损毁、拆除返还、玩家碰撞和完整存档；
- 普通潮石锚在风暴锚泊时会累积绞盘载荷并可能滑脱；研究后的锁链棘轮可直接加装、改变世界模型并稳定锚具；
- 定潮舵台提供自由航向、追踪浅滩、顺风避险与追踪信号四种航线；横风抗扭索具可直接加装到现有帆面，拆除时与帆套件一并返还；
- 潮听接收台与双桅定向阵列必须分离 2 至 6 个筏格布置；盐差电池提供 360 秒扫描时间，阵列状态、频率、相对方位、距离与电量均由世界实体和 HUD 同步表达；
- 三个原创命名信号按抵达顺序解码；导航状态使用持续世界坐标，目标中继标在真实海面位置出现，抵达半径内记录访问并解锁下一频段；
- 三座大型原创远海目的地（潮痕中继站、铁歌漂流阵、风针观测标）拥有独立结构规模、动画和专用 PBR；持续海图显示真实木筏/原点/路线，支持目标选择、发现链隐私、暂停入口和关闭后 Pointer Lock 恢复；
- 动态风向、八方帆向、木筏航向、风力利用与航速；舵台提高转向稳定性，正确帆向加快接近，未收帆会加快离流；
- 210 秒确定性海况周期包含积云、强风暴与消散阶段；阵风会造成偏航和帆具载荷，未强化帆过载后自动泄压收紧，避险航线与强化帆可共同降低风险；
- 原创飑云穹顶、GPU 实例化雨幕、双段闪电、风暴雾光、增幅浪高/泡沫/海色和独立风雨雷声层共同表达天气，而非仅改变 HUD 数值；
- 未锚泊浅滩仅短暂停留，玩家离筏后显示离流预警；离流阶段不会被传送回筏，错过追筏窗口后会被留在海中；
- v18 版本化自动存档继续保存逐格缘甲、收集网、多层脚底与结构状态，并新增鲨鱼伤势、漂浮尸体、采集段数和重生冷却；v1-v17 自动升级，非法鲨鱼状态、内缘、重复边位、悬空网具、超容量内容和伪造缘甲字段不会污染运行时；
- 三个独立航次档位在标题页显示航行时长、筏格数、失败、备份恢复和损坏状态；旧单档自动物化到航次一，活动档保留 `driftwake.save.v18` 工作副本兼容，主档按写前备份、写后回读校验落盘，主档损坏会只从同航次备份恢复；
- 设置提供 18 项可重映射物理键位、冲突拒绝与默认恢复；危险/天气/钓鱼/工具/失败恢复声音可选显示为字幕，支持标准、红弱、绿弱、蓝弱和高对比语义配色，以及减少镜头起伏、受击晃动和界面动态；
- 六总线程序音频混音、随完整相机姿态更新的 HRTF 落水/打捞定位、近场绳索受力与断裂层，以及水下低通、鲨鱼失力/浮尸/分段割取/下沉、震叉分段蓄能/就绪/失调/脉冲、生活/信号设备、锚帆、风雨雷声、种植、研究、礁区和生物声音；
- 标题、HUD、背包、制作、设置、能力提示和 Playwright 截图回归流程；
- 原创标题美术、木材、泡沫、鲨皮、编织纤维、AI 辅助海床、拼补帆布、培养土、耐火陶土、导航合金、信号层压板、磷光玻璃、共鸣青铜、电气陶瓷、潮缚索具、盐蚀工具钢、盐蚀集热玻璃、蜡封帆布、盐封手套、三种鱼皮、生/熟/焦鱼肉、远洋鱼眼、耐热折铁、盐蚀聚合物、盐冠活/枯叶与潮果、盐翼体羽/飞羽/角质/虹膜 PBR 与飑云天空材质，以及对应的独立 normal/roughness 图；风化雪松也已补齐 normal/roughness。

当前仍不是完整游戏。M6 钓鱼、烹饪/净水、天气农业、盐翼鸟害、M8 分阶段研究与远海目的地，以及 M9 三档存档/备份恢复、无障碍输入和首批工具/打捞历史材质整改的代码与自动视觉闭环已经完成；无说明玩家验收、目标真实 GPU 鼠标/双画质门禁、更多深水生态资源、潜水装备、最终蒙皮资产与其余 M9 发布系统仍按 [项目追踪](PROJECT_TRACKER.md) 继续开发。

## 运行

```sh
npm ci
npm run dev -- --port 4173
```

目标环境为带真实 GPU、WebGL2 和键鼠的桌面 Chrome / Edge。默认交互包括：装备钓竿后按住左键蓄力、松开抛投，鱼讯窗口内再次按下左键刺鱼，上钩后按张力间歇收线；鼠标也用于钩具抛投、刺击、砍伐、建造和开采；默认 `E` 交互/收取、`R` 执行替代操作、`F` 切换建造件型、`Q` 切换建造分类、`Space` 跳跃或上浮、左 `Ctrl` 下潜、`Tab`/`I` 背包、`C` 制作、数字键切换工具。所有这些动作均可在设置中重新绑定；旧默认别名仅在未重映射时保留。

## 验证

```sh
npm test
npm run build
npm run test:m1-runtime
npm run test:stability
npm run capture
```

截图脚本默认连接 `http://127.0.0.1:4173`，支持 `DRIFTWAKE_URL`、`CHROMIUM_PATH`、`CAPTURE_WIDTH`、`CAPTURE_HEIGHT`、`CAPTURE_QUALITY` 和 `CAPTURE_ONLY`。目标包括 `title`、`save-slots`、`save-recovery`、`accessibility`、`accessibility-caption`、`accessibility-bindings`、`pause`、`game`、`hook`、`salvage`、`fishing`、`cooking`、`collection-net`、`perimeter-defense`、`perimeter-defense-visual`、`structure-collapse`、`failure`、`shark-combat`、`shark-loot`、`shark-loot-water`、`pack`、`crafting`、`survival`、`durability`、`building`、`devices`、`advanced`、`signal`、种植/研究/岛屿/水下/导航各主流程、`underwater-narrow`、`narrow`、`settings` 和 `mobile`。`save-slots` 预置正常、备份可恢复与不可恢复损坏三档，验证标题页无 Canvas、桌面/窄屏布局和档位选择；`save-recovery` 真实进入备份航次，确认同槽主档修复、其它档位隔离、`pagehide` 备份轮换和钩具唯一所有权；`accessibility` 验证字幕/色觉/减少动态持久化、键位冲突与恢复默认，`accessibility-caption` 验证失败恢复声音字幕与布局，`accessibility-bindings` 验证重映射后的真实移动。`fishing` 的 `variety / capacity / all` 分段验证连续三鱼种真实捕获、拉力差异、材质预热/绑定、单实例鱼体、实际入包后磨损、部分容量返海、满包零磨损与 512x320 HUD；`FISHING_VISUAL_IDS` 可隔离指定物种的 1024x640 高画质捕获近景。`cooking` 的 `base / burnt / visual / all` 分段验证真实投料/收取、自然焦黑、生/熟/焦 PBR 和基础生活设备近景；`COOKING_VISUAL_TARGET=base|triple|all` 可隔离视觉场景。`shark-combat` 的 `visual`、`counter`、`resonance`、`water` 分段验证蓄势 HUD、限时矛击、震叉取消/锁定/原子消耗/驱离，以及水中两次结算上限；默认用页面内边沿事件保证软件 GLES 确定性，目标真实 GPU 使用 `SHARK_COMBAT_INPUT=mouse` 复验 Playwright 鼠标时序。`shark-loot` 验证木筏边真实刺击、四段按住采集、满包四份池化落海、v18 冷启动和水中全部入包；`shark-loot-water` 可独立复验水中路径。`building` 的 `behavior`、`visual`、`traversal`、`ceiling`、`damage` 分段分别验证分类/件型选择隔离、建造/替换事务、512×320 HUD、多层移动、楼板/斜顶撞顶速度截断，以及鲨鱼撕咬、v18 受损恢复和真实锤修；`collection-net` 验证背包安置、被动截获、E 收取、v18 冷重载与锤拆返还；`perimeter-defense` 验证缘甲安装/返料、同侧网具择靶、55% 减伤、E 修补、冷重载和毁网落物；`structure-collapse` 验证真实鲨鱼咬断承重柱、四件结构级联、双块坠落、逐件入水回收和只保存最终结构真值。3D 截图使用分布式 WebGL 像素门禁，拒绝黑屏、白屏、HUD 相交和丢失的上下文。

Termux Chromium 149 的纯 headless 后端会在 WebGL draw call 后首次 readback 时丢失上下文。M1 曾以 Debian Chromium 150 + Xvfb/headful GLES 完成冻结版 1200 秒软件长稳；2026-07-20 当前 Termux 的最终构建可稳定完成 `crafting`、`survival`、分段 `durability`、`building`、`collection-net`、`perimeter-defense`、`structure-collapse`、`shark-combat`、`shark-loot` 与 `fishing` 的领域/交互/v18 写入，也可完成结构、缘甲、装载网具、坠落实体、鲨鱼蓄势/鲨体和三鱼种捕获场景的有效像素或合成帧回读。加速门禁仍驱动正式固定步并受 `maxSubSteps` 钳制，只作为正确性与构图证据；冷启动恢复、锤修和锤拆继续使用原生时间。真实 GPU 的 1280x720/30、1920x1080/60、M2 十分钟手感、M3 失败页恢复画面/混音、M4 两层扩建/攻防手感、M5 战斗/采集，以及 M6 钓鱼鼠标手感/材质/混音仍是发布门禁。详见 [M1 验收记录](docs/M1_ACCEPTANCE.md)、[M2 验收记录](docs/M2_ACCEPTANCE.md)、[M3 验收记录](docs/M3_ACCEPTANCE.md)、[M4 验收记录](docs/M4_ACCEPTANCE.md)、[M5 验收记录](docs/M5_ACCEPTANCE.md) 与 [M6 验收记录](docs/M6_ACCEPTANCE.md)。

M5 连续门禁复现：`CAPTURE_ONLY=shark-loot SHARK_LOOT_STAGE=loop CAPTURE_FAST=1 npm run capture`。软件环境默认使用页面内边沿事件；目标真实 GPU 使用 `SHARK_LOOT_INPUT=mouse`，并按 `docs/M5_ACCEPTANCE.md` 的双画质与无说明玩家清单验收。

M6 钓鱼门禁复现：`CAPTURE_ONLY=fishing FISHING_STAGE=variety CAPTURE_FAST=1 npm run capture` 验证连续三鱼种；`CAPTURE_ONLY=fishing FISHING_STAGE=capacity CAPTURE_FAST=1 npm run capture` 验证部分容量与满包事务；指定 `FISHING_VISUAL_IDS=silver-spine,sailtail-runner,amber-fin CAPTURE_QUALITY=high` 生成三鱼种近景，详细阈值见 `docs/M6_ACCEPTANCE.md`。

M6 烹饪门禁复现：`CAPTURE_ONLY=cooking COOKING_STAGE=base npm run capture` 验证真实投料/等待/收取，`COOKING_STAGE=burnt` 验证完整焦鱼边界；视觉阶段分别使用 `COOKING_STAGE=visual COOKING_VISUAL_TARGET=triple` 与 `COOKING_VISUAL_TARGET=base` 生成三火候和基础设备高画质近景，详细阈值见 `docs/M6_ACCEPTANCE.md`。

M6 种植门禁复现：`CAPTURE_ONLY=planting-weather npm run capture` 验证同一天气真值驱动雨水恢复、增长/水耗倍率、风暴驱鸟与 HUD；`CAPTURE_ONLY=planting-materials npm run capture` 和 `CAPTURE_ONLY=planting-bird npm run capture` 分别生成作物三状态与盐翼鸟高画质 PBR 近景。

M8 专用截图目标包括 `signal-destinations`、`signal-destination-materials`、`signal-chart` 和 `progression-growth`；后者验证三阶段研究依赖、桌面/窄屏滚动结构及恢复后的钩具唯一所有权。详见 [M8 验收记录](docs/M8_ACCEPTANCE.md)。

M9 存档门禁复现：`CAPTURE_ONLY=save-slots npm run capture` 验证三档标题页；`CAPTURE_ONLY=save-recovery CAPTURE_FAST=1 npm run capture` 验证同槽备份进入、主档修复与 `pagehide` 检查点。详见 [M9 验收记录](docs/M9_ACCEPTANCE.md)。

M9 无障碍门禁复现：`CAPTURE_ONLY=accessibility npm run capture` 验证设置与窄屏；`CAPTURE_ONLY=accessibility-caption npm run capture` 验证真实恢复字幕；`CAPTURE_ONLY=accessibility-bindings CAPTURE_FAST=1 npm run capture` 验证重映射输入。详见 [M9 无障碍验收记录](docs/M9_ACCESSIBILITY_ACCEPTANCE.md)。

M9 工具/打捞材质门禁复现：`CAPTURE_ONLY=salvage CAPTURE_FAST=1 npm run capture` 使用精确世界掉落瞄准和真实键鼠完成拾取、断钩与重制，并输出 WebGL framebuffer 场景图，避开 X11 空合成层。详见 [M9 材质整改验收记录](docs/M9_MATERIAL_ACCEPTANCE.md)。

## 资产管线

`scripts/imagegen` 会在运行时读取当前 Codex provider 的 `base_url` 与本地认证文件中的 API Key，仓库不会保存服务 URL 或密钥：

```sh
scripts/imagegen generate --prompt "..." --quality high --out output/imagegen/example.png
```

历史占位材质工具与审定源图的 normal/roughness 派生需要 Pillow。程序材质只能维持显式占位，不能通过最终资产门禁：

```sh
python scripts/generate_procedural_materials.py --out-dir public/assets/textures --size 1024
python scripts/derive_material_maps.py --input albedo.webp --normal normal.webp --roughness roughness.webp
python scripts/prepare_imagegen_sail.py --input output/imagegen/sail.png --albedo sail.webp --normal sail-normal.webp --roughness sail-roughness.webp
python scripts/prepare_imagegen_soil.py --input output/imagegen/soil.png --albedo soil.webp --normal soil-normal.webp --roughness soil-roughness.webp
python scripts/prepare_imagegen_material.py --input output/imagegen/material.png --albedo material.webp --normal material-normal.webp --roughness material-roughness.webp
python scripts/prepare_imagegen_eye.py --input artifacts/imagegen/pelagic-fish-eye-raw.png --albedo public/assets/textures/pelagic-fish-eye.webp --normal public/assets/textures/pelagic-fish-eye-normal.webp --roughness public/assets/textures/pelagic-fish-eye-roughness.webp
```

完整来源、最终提示词、采用/拒绝结论和模型清单见 [原创资产清单](docs/ASSET_MANIFEST.md)；历史低质、纯色与跨题材复用材质的整改优先级见 [运行时材质质量审计](docs/ASSET_QUALITY_AUDIT.md)。
