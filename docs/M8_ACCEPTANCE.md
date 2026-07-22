# M8 研究、熔炼与导航成长验收记录

> 当前状态：`DONE`（代码与自动验收闭环；无说明玩家和真实 GPU 作为 M9 发布门禁保留）
> 本次切片：三阶段研究成长、远征资源合同、三座原创远海目的地、航海图、近场音频与 M8 专用 PBR
> 版本：`0.20.0`
> 日期：2026-07-22

## 目的地领域合同

- 信号链提供三个有稳定 ID 的目的地：`tideRelay`（潮痕中继站，73.14 MHz）、`ironChoir`（铁歌漂流阵，41.82 MHz）和 `stormNeedle`（风针观测标，89.06 MHz）。目标坐标相对于首次装入电池时的信号原点保存，不随页面刷新或木筏局部坐标漂移。
- 目的地按发现链逐段解锁；运行时清洗器拒绝跳过前置访问、伪造原点、重复目标和超长目标列表。未发现目标不会暴露名称、频率、摘要或绝对坐标。
- 三座目的地都是真实海面 Group，不是 HUD 图标或瞬时菜单奖励；目标实体按发现状态、距离和抵达半径驱动显隐、访问记录、脉冲、旋转、摆锤/飘带与通知。
- `NavigationSystem`、`gameStore`、v18 存档和 `SeaChartPanel` 共享同一 `signalWorldPosition` / chart telemetry；航海图选择目标会真实更新追踪航线和舵台方位，并即时保存。

## 研究与成长合同

- 15 项研究按 `炉工基础 4 / 筏上工业 6 / 远海测向 5` 分为三阶段；研究面板只呈现当前阶段，显示总进度、阶段进度、可推演数量、实物样本和项目前置，不再一次铺出全部项目。
- 项目依赖形成稳定闭包：`回潮熔炉 -> 潮铸密封铰链 -> 潮听信号板 -> 盐差电池 -> 潮听接收台 -> 双桅定向阵列`。学习、可用计数和存档清洗共享同一前置表；伪造高级项目或失效前置会级联移除。
- 首套接收台/阵列路线包含 7 块湿砖、2 枚铰链、4 块信号板、1 枚电池和两座设备，折算原料为 `19 砂 / 14 黏土 / 10 金属矿 / 48 木材 / 22 废铁 / 16 聚合物 / 3 绳索`。
- 单轮浅礁固定提供 `8 砂 / 8 黏土 / 4 金属矿`：两轮必然缺少砂和矿石，三轮完整采集可覆盖进阶矿物；三轮岛屿固定木材产出覆盖熔炼燃料与设备骨架。该合同约束路线密度，但不以任务箭头替代玩家判断。
- `progression-growth` 浏览器门禁从信号板前置锁定开始，真实学习铰链、信号板、电池和接收台，再验证阵列/震叉进入可推演；桌面 1024x640 与窄屏 640x720 的阶段导航均留在对话框内，无文本裁切。

## 三座实体与视觉合同

| 目标 | 结构证据 | 运行时材质 | 动画/状态 |
| --- | --- | --- | --- |
| 潮痕中继站 | 47 meshes，垂直高度 >3.8 m | signal laminate / phosphor glass / choir bronze PBR | 三浮筒错相升沉、双转子、四层脉冲环 |
| 铁歌漂流阵 | 90 meshes，横向宽度 >8 m | signal laminate / phosphor glass / Image 2 choir bronze PBR | 五个共鸣腔、五个摆锤、顶部转子、距离灯 |
| 风针观测标 | 83 meshes，垂直高度 >9 m | signal laminate / phosphor glass / choir bronze / Image 2 storm ceramic PBR | 三浮舱、四层传感平台、三轴笼、三组风向飘带 |

模型由 `src/game/art/SignalModels.ts` 生成，结构阈值、唯一名称、材质图绑定和包围盒由 `src/game/art/ProceduralModels.test.ts` 锁定。目标特有材质不会回退为旧 `metal`、`rustMetal` 或纯色占位。

## 海图与暂停恢复

- 暂停页在发现首个信号后提供图标入口；进入海图会先释放 Pointer Lock，背景模拟停止在暂停预算，关闭后再由“继续漂流”申请锁定。
- 桌面海图使用真实持续世界原点、木筏位置、目标路线、访问进度、北向（世界 `-Z`）和东西/南北坐标；窄屏改为上下分栏，正文、按钮和图例不裁切、不横向溢出。
- 锁定目标的航海图门禁覆盖：初始 `2` 个可见标记、`3` 条账册、`1` 条隐去频段；切换至潮痕中继站后 HUD/航线同步 `73.14 MHz`。
- 暂停打开/关闭、桌面/窄屏布局和 Pointer Lock 恢复均通过 `scripts/capture.mjs`；恢复后钩具必须保持 `idle + heldVisible`，不得同时出现飞行钩或绳索。
- `HookSystem` 现在要求 Canvas Pointer Lock 才接受抛投输入，锁定恢复后的 140 ms 手势保护窗会丢弃恢复点击；失去输入权限会原子清理投射物和绳索。这修复了手机浏览器“第二次点击才进入”和暂停返回后远处残留抛钩的问题。

## 音频合同

`AudioSystem` 为三座目标建立三个不同的程序层：潮痕中继站的低频继电脉冲、铁歌漂流阵的多谐波金属合唱、风针观测标的滤波风噪/电气音。每层都有距离衰减、相对第一视角相机方向的立体声声像和当前目标强调；诊断要求 `layersReady=true`、`layerCount=3`，近场目标的 `proximity` 与 `pan` 保持在 `[0,1]` / `[-1,1]`。

## 自动验收

领域、材质和组件合同：

```sh
npx vitest run src/game/domain/navigation.test.ts \
  src/game/art/Materials.test.ts \
  src/game/art/ProceduralModels.test.ts \
  src/game/systems/AudioSystem.test.ts \
  src/components/SeaChartPanel.test.ts \
  src/game/systems/HookSystem.test.ts
```

浏览器证据：

```sh
CAPTURE_ONLY=signal-destinations DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=signal-destination-materials DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=signal-chart DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
CAPTURE_ONLY=progression-growth DRIFTWAKE_URL=http://127.0.0.1:4173 npm run capture
```

`signal-destinations` 逐一在约 22 m 处验证三种轮廓、距离显隐、材质图、音频和 HUD 几何；`signal-destination-materials` 在约 10 m 处验证铁歌/风针的专用 PBR、访问/激活状态和三层近场音频；`signal-chart` 验证桌面 1024x640、窄屏 640x720、锁定目标隐私、路线选择、Pointer Lock 生命周期及单一手持钩。

本轮全量 Vitest：48 个测试文件、303 项通过。

本机 Termux 使用 Xvfb/软件 GLES 或 DOM 合成帧只作为行为、构图和资源证据，不冒充真实 GPU 性能。真实 GPU 1280x720/30、1920x1080/60、鼠标航行手感、音频设备输出和 20 分钟长稳仍属于 M9 发布门禁。

## M8 专用材质来源

- `iron-choir-resonant-bronze`：项目 `scripts/imagegen`，`gpt-image-2`、`quality=high`、2048x2048；采用旧金/冷镍锤击铜镍合金平铺源图，拒绝器物轮廓、锈蚀过重和方向性高光。
- `storm-needle-electret-ceramic`：项目 `scripts/imagegen`，`gpt-image-2`、`quality=high`、2048x2048；采用哑光盐烧瓷釉平铺源图，拒绝 terrazzo/混凝土/石屑候选和大颗粒聚集。
- 两套材质均派生 1024 albedo/normal/roughness，执行 seam、boundary、2x2 平铺、地图相关性和真实目的地近景检查；采用源 PNG 保存在 `artifacts/imagegen/`，运行时只引用 `public/assets/textures/` 的 WebP 三件套。

## M9 发布门禁

M8 的代码与自动验收已关闭。30-60 分钟无说明玩家节奏仍需验证实际迷路率、研究阶段理解和废铁压力；最终 DCC 蒙皮、多样本录音、真 Context Lost/Restore 与目标 GPU 发布验证统一进入 M9，不以本机软件证据冒充通过。
