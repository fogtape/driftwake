# 运行时材质质量审计

> 建立日期：2026-07-20；最近更新：2026-07-22
> 状态：`DOING`
> 约束来源：`PROJECT_TRACKER.md` 5.1 硬性资产门禁

## 审计规则

- 所有新增成品位图贴图必须由项目 `scripts/imagegen` CLI 使用 `gpt-image-2 high` 生成原创源图；
- 采用源图必须归档，运行时 albedo / normal / roughness 必须独立派生，并记录完整提示词、尺寸、处理参数和接缝结果；为满足硬预算允许在派生后做可逆通道打包，但必须验证像素一致性与 shader 读取通道；
- 近景、高频、第一人称和核心交互资产优先；触及旧系统时必须同步替换相关低质占位材质；
- 单一纯色、临时程序纹理或跨题材复用材质只能维持显式占位状态，不能作为最终美术验收证据；
- 数值接缝通过不等于视觉通过，仍须检查原图、处理图、2x2 平铺和真实场景截图；
- Imagegen 暂时不可用时不得降级模型或质量，只能继续几何、UV、动画与玩法工作，并保持资产项未完成。

## 已通过高质量来源门禁

以下类别已有 `gpt-image-2 high` 采用源图、运行时文件和 `docs/ASSET_MANIFEST.md` 来源记录，后续仍需在涉及的最终场景中复核色彩统一性：

| 类别 | 当前资产 | 状态 |
| --- | --- | --- |
| 主视觉 | 标题主视觉 | `APPROVED` |
| 木筏主体 | 风化雪松 | `APPROVED` |
| 海洋/环境 | 海面泡沫、礁床、飑云 | `APPROVED` |
| 生物/纤维 | 深潮鲨皮、编织纤维、盐封手套 | `APPROVED` |
| 建筑/生活设备 | 帆布、培养土、耐火陶土、导航合金、盐玻璃、密舱帆布、耐热折铁、盐蚀聚合物 | `APPROVED` |
| 信号设备 | 信号层压板、磷光玻璃 | `APPROVED` |
| M6 钓鱼鱼体 | 银脊鱼皮、琥鳍鲷皮、旗尾梭皮、远洋鱼眼 | `APPROVED`：来源、PBR、三鱼种捕获近景与运行时绑定通过 |
| M6 烹饪食材 | 鲜鱼肉、火烤熟鱼肉、焦黑鱼肉 | `APPROVED`：来源、独立 PBR、基础真实收取与三槽生/熟/焦同屏通过 |
| M6 种植与鸟害 | 盐冠活叶/枯叶/潮果、盐翼体羽/飞羽/角质/虹膜 | `APPROVED`：来源、七套独立 PBR、三状态作物与盐翼鸟近景通过 |
| M8 远海目的地 | 铁歌漂流阵共鸣青铜、风针观测标电气陶瓷 | `APPROVED`：两套 Image 2 high 源图、六张独立 PBR、2x2/边界/地图相关性与铁歌/风针近景通过 |
| M9 工具与打捞基础材质 | 风化雪松 PBR、潮缚索具、盐蚀工具钢、盐蚀聚合物 | `APPROVED`：两套新增 Image 2 high 源图、雪松 PBR 补齐、12 张运行图绑定、2x2 与 framebuffer 近景通过 |
| M9 岛屿与岸上资源 | 风暴冲刷岛岩、盐冠棕榈树皮/叶面、野生潮果、岸滩地表 | `APPROVED`：五套 Image 2 high 源图、15 个 PBR 槽、2x2、alpha roughness 精确打包与 `32/32` framebuffer 岛屿场景通过 |
| M9 水下礁区与资源 | 浸水礁岩、暖/浅两类珊瑚、长叶海草、盐壳金属矿、潮红礁泥、盐冠礁鱼皮 | `APPROVED`：七套 Image 2 high 源图、21 个 PBR 槽、2x2、共享双图集/alpha roughness 与当前 `29/32` framebuffer/收割场景通过 |
| M9 结构与防御 | 风暴撑紧固合金、风暴伤雪松横截面，并复用雪松/索具/工具钢/导航合金 | `APPROVED`：两套 Image 2 high 源图、临界真实断面、11 区共享双图集、结构/周界 `30/32` 与水下 `29/32` framebuffer 通过 |

## 历史占位整改队列

| 优先级 | 范围 | 当前问题 | 替换要求 | 目标切片 | 状态 |
| --- | --- | --- | --- | --- | --- |
| P0 | 三种钓获鱼 | 旧银脊鱼使用金属/聚合物/鲨皮并缺少物种差异 | 三套独立鱼皮与鱼眼 Image 2 源图、PBR、UV、三物种捕获场景 | M6 钓鱼 | `APPROVED` |
| P0 | 鲜鱼段与熟鱼排 | 旧食物使用纯色肉材质，生熟焦变化缺少专用表面 | 三套同尺度 Image 2 鱼肉源图、PBR、UV、基础/三槽烹饪场景 | M6 烹饪 | `APPROVED` |
| P0 | 作物与盐翼盗鸟 | 叶、枯叶、果实、羽毛、翼面和喙以纯色区分 | 作物叶脉/果皮、羽毛/翼面原创贴图组，生长/枯萎/鸟害场景统一 | M6 种植 | `APPROVED` |
| P0 | 基础烤架、净水器与三槽烤台 | 通用纯色锈铁、金属、聚合物、暗木和绳材质近景重复 | 耐热折铁、盐蚀聚合物，并复用已审定雪松/编织纤维/耐火陶土/导航合金 | M6 烹饪 | `APPROVED` |
| P1 | 第一人称工具与漂流物 | 原通用 metal / rustMetal / polymer / rope / darkWood 为纯色或不完整 PBR | 盐蚀工具钢、潮缚索具、盐蚀聚合物与三图雪松统一覆盖；普通钢/锈蚀五金使用不同 PBR 参数 | M2/M3/M5 回溯 | `APPROVED` |
| P1 | 岛屿与岸上资源 | 原 leaf / rock / foliage 及部分采集节点以纯色和顶点色为主 | 岛岩、树皮、叶面、果皮、纤维、矿物与岸滩微表面原创 PBR 组 | M7 回溯 | `APPROVED` |
| P1 | 水下礁区与资源 | reefRock / coral / seaweed / ore / clay / reefFish 多为纯色材质 | 礁岩、两类珊瑚、海草、矿砂/黏土及鱼群贴图组 | M7 回溯 | `APPROVED` |
| P1 | 结构与防御设备 | 结构件主要依赖雪松，但连接件、金属、绳和受损变化仍有纯色复用 | 连接件/紧固件/受损截面专用 PBR，并与雪松保持统一 | M4/M5 回溯 | `APPROVED` |
| P2 | 生物口腔、眼与小型细节 | 三种钓获鱼与盐翼鸟已使用专用虹膜；sharkMouth / sharkEye 仍是简单纯色材质 | 只在实际屏幕覆盖可辨时增加专用微材质；仍须场景近景证明 | M5/M6/M9 | `DOING` |
| P2 | UI 位图与图标 | 当前主要为代码图标和 CSS，不得引入低质位图占位 | 新增位图同样执行 Image 2 high、来源和目标分辨率检查 | M9 | `WATCH` |

## M6 首批证据

| 资产 | Image 2 请求 | 运行时处理 | 数值结果 | 视觉状态 |
| --- | --- | --- | --- | --- |
| 银脊鱼皮 | 2048x2048 / high | 1024，seam 156，normal 0.58，roughness 118-196 | x=9.35/1.29x，y=11.31/1.14x | `APPROVED`：大型捕获近景与六贴图绑定通过 |
| 琥鳍鲷皮 | 2048x2048 / high | 1024，seam 156，normal 0.62，roughness 126-204 | x=9.42/1.14x，y=6.86/1.20x | `APPROVED`：大型捕获近景与六贴图绑定通过 |
| 旗尾梭皮 | 2048x2048 / high | 1024，seam 48，normal 0.54，roughness 114-190 | x=4.07/1.25x，y=14.32/1.12x | `APPROVED`：拒绝宽羽化带版，采用版捕获近景通过 |
| 远洋鱼眼 | 2048x2048 / high | 1024，非重复中心布局，normal 0.28，roughness 58-138 | pupil=2.0，iris=105.5，edge=3.9 | `APPROVED`：三鱼种近景尺寸、虹膜与眼缘通过 |
| 鲜鱼肉 | 2048x2048 / high | 1024，seam 168 + boundary，normal 0.44，roughness 148-216 | x=3.28/1.00x，y=5.17/0.97x | `APPROVED`：基础投料与三槽生鱼同屏通过 |
| 火烤熟鱼肉 | 2048x2048 / high edit | 1024，seam 168 + boundary，normal 0.44，roughness 150-214 | x=4.95/0.89x，y=7.28/0.93x | `APPROVED`：真实收取与基础/三槽近景通过 |
| 焦黑鱼肉 | 2048x2048 / high edit | 1024，Image 2 焦斑 + 可审计提亮，normal 0.50，roughness 178-236 | x=18.01/1.11x，y=19.34/0.93x | `APPROVED`：拒绝树皮感/低对比候选，采用版缩略图和同屏焦黑可辨 |
| 耐热折铁 | 2048x2048 / high | 1024，seam 144 + boundary，normal 0.68，roughness 138-220 | x=5.11/1.01x，y=5.75/0.86x | `APPROVED`：基础热碗/火盆/炉条与三槽炉口/炉条近景通过 |
| 盐蚀聚合物 | 2048x2048 / high | 1024，seam 144 + boundary，normal 0.38，roughness 118-194 | x=8.92/1.07x，y=8.36/0.88x | `APPROVED`：基础集水杯、杯沿与五联盆体绑定通过 |
| 盐冠活叶 | 2048x2048 / high | 1024，seam 152 + boundary，normal 0.54，roughness 132-210 | x=7.01/0.86x，y=8.93/1.16x | `APPROVED`：活株/成熟株叶面与低光可读性通过 |
| 盐冠枯叶 | 2048x2048 / high edit | 1024，seam 152 + boundary，normal 0.66，roughness 190-244 | x=6.31/0.84x，y=6.75/0.97x | `APPROVED`：同源叶脉与三状态作物同屏通过 |
| 盐冠潮果 | 2048x2048 / high | 1024，seam 152 + boundary，normal 0.48，roughness 138-210 | x=5.76/0.93x，y=5.70/0.85x | `APPROVED`：成熟果缩略尺度与真实收获提示通过 |
| 盐翼体羽 | 2048x2048 / high | 1024，seam 168 + boundary，normal 0.46，roughness 176-236 | x=9.54/0.90x，y=4.84/0.96x | `APPROVED`：近景体羽层叠与低光响应通过 |
| 盐翼飞羽 | 2048x2048 / high | 1024，seam 168 + boundary，normal 0.58，roughness 174-232 | x=11.16/0.91x，y=16.64/0.95x | `APPROVED`：翼/尾/眉羽与体羽差异通过 |
| 盐翼角质 | 2048x2048 / high | 1024，seam 144 + boundary，normal 0.34，roughness 154-218 | x=7.12/1.07x，y=6.67/0.95x | `APPROVED`：拒绝两版石纹候选，采用低对比毫米级表面 |
| 盐翼虹膜 | 2048x2048 / high | 1024，非重复中心布局 | pupil=13.1，iris=92.0，edge=15.3 | `APPROVED`：有朝向圆面与鸟体近景通过 |

## M9 工具与打捞证据

| 资产 | Image 2 请求 | 运行时处理 | 数值结果 | 视觉状态 |
| --- | --- | --- | --- | --- |
| 潮缚索具 | 2048x2048 / high / CLI | 1024，seam 160，normal 0.68，roughness 184-246，boundary | x=13.52/1.00x，y=13.73/1.02x | `APPROVED`：原图与 2x2 无硬缝；钩具扎结、网床/设备索具统一绑定 |
| 盐蚀工具钢 | 2048x2048 / high / CLI | 1024，seam 152，normal 0.56，roughness 112-194，boundary | x=7.29/1.08x，y=10.22/1.00x | `APPROVED`：无器物轮廓/烹饪语义；framebuffer 钩体明暗轮廓通过 |
| 风化雪松 PBR 补齐 | 沿用审定 TEX-001 Image 2 albedo | 1254，normal 0.52，roughness 178-238 | 既有 2x2 连续性保持 | `APPROVED`：三种筏板、深木与工具柄改用独立 normal/roughness，不再把 albedo 当 bump |
| 盐蚀聚合物复用 | 沿用审定 TEX-024 Image 2 源图 | 原 1024 PBR | x=8.92/1.07x，y=8.36/0.88x | `APPROVED`：聚合漂流物、浮子和容器使用 PBR，生活设备仍保持同一材料语义 |

浏览器证据使用精确世界掉落瞄准、真实 `KeyE`、断钩/重制与 WebGL framebuffer 直读；回收包结算后资源精确为 `2 棕榈纤维 / 1 氧化废铁`、活动掉落为 0，钩具唯一所有权在断裂和 `48/48` 重制后均通过，运行时纹理为 `20/32`。X11 合成层空帧不作为美术证据，目标真实 GPU 仍需最终双画质近景复验。

## M9 岛屿与岸上资源证据

| 资产 | Image 2 请求 | 运行时处理 | 数值结果 | 视觉状态 |
| --- | --- | --- | --- | --- |
| 风暴冲刷岛岩 | 2048x2048 / high / CLI | 1024，seam 160，normal 0.62，roughness 176-238 | x=9.38/0.96x，y=12.74/0.88x | `APPROVED`：地标岩、石堆和石具不再使用纯色 |
| 盐冠棕榈树皮 | 2048x2048 / high / CLI | 1024，seam 176，normal 0.66，roughness 184-242 | x=20.48/0.97x，y=10.97/1.03x | `APPROVED`：纵纤维/生长带与筏板雪松分离 |
| 盐冠棕榈叶面 | 2048x2048 / high / CLI | 1024，seam 168，normal 0.52，roughness 148-220 | x=8.16/1.09x，y=17.91/0.91x | `APPROVED`：叶片、灌木、纤维簇和纤维漂流物语义统一 |
| 野生潮果果皮 | 2048x2048 / high / CLI | 1024，seam 160，normal 0.42，roughness 116-188 | x=11.43/1.09x，y=9.29/0.90x | `APPROVED`：冠层/落地潮果不再使用叶材质，也不复用盆栽果 |
| 盐冠岸滩地表 | 2048x2048 / high / CLI | 1024，seam 168，normal 0.54，roughness 184-242；roughness 打包 alpha | x=18.08/1.14x，y=19.56/1.15x | `APPROVED`：高度场 UV+PBR 保留顶点分区色；alpha 与原 roughness 像素一致 |

`CAPTURE_ONLY=island CAPTURE_FAST=1` 输出真实 `island-materials-canvas.png`，直接画布像素 `variation=234/nonBlack=2763`；15 个材质槽完整，renderer 为 `32 textures / 193 geometries / 165 calls / 87,520 triangles`，Context 与模拟状态健康。首轮独立三图为 33 张纹理并被拒绝，采用 alpha roughness 通道打包后回到硬预算 32，没有抬高预算或删除 PBR 信息。详见 `docs/M9_ISLAND_MATERIAL_ACCEPTANCE.md`。

## M9 水下礁区与资源证据

| 资产 | Image 2 请求 | 运行时处理 | 数值结果 | 视觉状态 |
| --- | --- | --- | --- | --- |
| 浸水盐冠礁岩 | 2048x2048 / high / CLI | 1024，seam 176，normal 0.62，roughness 176-238 | x=15.26/1.01x，y=14.63/0.93x | `APPROVED`：礁岩/固着石不再使用纯色，并与岸上岛岩分离 |
| 暖枝珊瑚 | 2048x2048 / high / CLI | 1024，seam 168，normal 0.52，roughness 156-220 | x=17.79/1.07x，y=17.67/0.93x | `APPROVED`：红色 calcite 与细小 corallite 在枝/芽实例可辨 |
| 浅色潮冠珊瑚 | 2048x2048 / high / CLI | 1024，seam 168，normal 0.54，roughness 166-228 | x=13.27/0.92x，y=13.77/0.94x | `APPROVED`：骨白/烟绿物种层与暖珊瑚明确分离 |
| 长叶海草组织 | 2048x2048 / high / CLI | 1024，seam 168，normal 0.46，roughness 136-208 | x=13.96/1.01x，y=9.61/1.01x | `APPROVED`：拒绝整叶重叠初稿；采用连续单层组织并经实景提亮复核 |
| 盐壳金属矿 | 2048x2048 / high / CLI | 1024，seam 168，normal 0.68，roughness 118-210 | x=12.82/1.02x，y=13.56/0.92x | `APPROVED`：矿点晶体/熔炉矿样共享正确 atlas shader，不再是纯青色 |
| 潮红礁泥 | 2048x2048 / high / CLI | 1024，seam 168，normal 0.52，roughness 184-242 | x=8.14/1.11x，y=8.54/0.93x | `APPROVED`：水浸黏土与熟陶、锈铁和肉质分离 |
| 盐冠礁鱼皮 | 2048x2048 / high / CLI | 1024，seam 160，normal 0.42，roughness 112-188 | x=10.97/0.99x，y=9.10/0.88x | `APPROVED`：三组小型鱼群不再使用纯青灰材质 |

七套独立审计 PBR 通过 2x2 人工复核后，以 960 核心 + 32 gutter 写入共享双图集；albedo RGB 与 roughness alpha 共图，normal 独立，保存后 alpha 像素一致。`0.22.4` 图集扩为 4096x3072/11 区后，`CAPTURE_ONLY=underwater CAPTURE_FAST=1` 继续验证 21 个带区域名的槽、`29 textures / 118 geometries / 255 calls / 140,618 triangles` 和健康 Context/模拟；直接像素为 `variation=125/nonBlack=2880`。`underwater-interaction` 继续真实完成“收割长叶海草”与 `+2 海草`。详见 `docs/M9_UNDERWATER_MATERIAL_ACCEPTANCE.md`。

## M9 结构与防御证据

| 资产 | Image 2 请求 | 运行时处理 | 数值结果 | 视觉状态 |
| --- | --- | --- | --- | --- |
| 风暴撑紧固合金 | 2048x2048 / high / CLI | 1024，seam 168，normal 0.56，roughness 132-210 | x=8.58/1.13x，y=9.26/0.93x | `APPROVED`：拒绝深色板岩感和过度均匀候选；筏钉、结构连接件、网具夹具、缘甲角固件统一绑定 |
| 风暴伤雪松横截面 | 2048x2048 / high / CLI | 1024，seam 168，normal 0.64，roughness 182-242 | x=6.45/1.11x，y=9.26/0.95x | `APPROVED`：拒绝 OSB/木屑拼堆候选；临界承梁出现浅色连续横切面，修复后实例归零 |
| 盐蚀工具钢 atlas 迁移 | 沿用审定 TEX-035 Image 2 源图 | 960 核心 + 32 gutter，RGB/A roughness + normal | 重建前后 atlas SHA-256 一致 | `APPROVED`：移除三张独立运行加载，通用工具/五金语义和 PBR 参数保持 |
| 盐蚀导航合金 atlas 迁移 | 沿用审定 TEX-009 Image 2 源图 | 960 核心 + 32 gutter，RGB/A roughness + normal | 重建前后 atlas SHA-256 一致 | `APPROVED`：缘甲长导轨与导航设备仍使用独立区域，不与紧固合金混色 |

`building damage` 真实完成鲨鱼双咬、冷启动、横截面出现及三锤全修，renderer 为 `30 textures / 79 geometries / 110 calls / 113,924 triangles`；`perimeter-defense-visual` 验证六个护栏/紧固件槽与载货网具附着，renderer 为 `30 / 88 / 129 / 105,592`。两场 Context 与模拟健康，framebuffer 已人工复核。详见 `docs/M9_STRUCTURE_MATERIAL_ACCEPTANCE.md`。

## 完成条件

审计项只有同时满足以下条件才能从队列移入 `APPROVED`：

1. `artifacts/imagegen/` 有采用源图，且没有服务 URL、API Key 或版权不明输入；
2. `public/assets/` 只包含审定后的运行时规格，构建无 404、色彩空间或 WebGL 警告；
3. `docs/ASSET_MANIFEST.md` 记录模型、质量、尺寸、提示词、处理参数和采用/拒绝原因；
4. 接缝绝对差不超过 24、相对内部差不超过 1.35 倍，且 2x2 人工检查没有十字带、硬边或重复焦点；
5. 对应系统截图证明纹理尺度、UV、光照、动画形变和相邻资产画风一致；
6. 逻辑测试、生产构建和相关 Playwright 流程全部通过。
