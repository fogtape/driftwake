# Driftwake

原创桌面网页 3D 海上生存游戏。当前版本为 `0.12.1` 高质量纵向切片，不以基础 Demo 为完成标准。

## 当前内容

- Three.js 程序化海面、天空、雾、昼光、随波木筏和可接近的高度场岛屿；
- 统一 60 Hz 固定步模拟、渲染插值、失焦/隐藏/WebGL Context 生命周期门禁，以及可诊断的积压丢弃保护；
- 完整昼夜环境采样、木筏水平参考系、跳跃/落地状态机、三档镜头舒适度和运行时动态分辨率；
- 玩家首次开始后才延迟加载 Three.js/Rapier 世界；初始化完成会先进入稳定暂停画面，再由“继续漂流”申请鼠标锁；
- 第一人称移动、盐封帆布双手抓握、蓄力/放绳/受力收绳、19 点张力曲线、水花、五类漂流物、补给箱/桶战利品，以及带世界聚焦环的近距离手拾取；
- 打捞钩拥有 48 次抛投耐久，断裂会真实移除工具；背包拒收的战利品保留为池化海面掉落，并可通过近拾材料制作替代钩恢复；
- 数据驱动的 48 类物品、20 格堆叠背包、28 项便携配方、研究门禁、消耗品和固定步长生存状态；
- 可寻址木筏筏格、邻接建造、幽灵预览、材料校验、修补、拆除与连通性保护；
- 浮标抛投、鱼讯窗口、张力/收线对抗、断线、鱼体挣扎和收获；
- 基础潮汐净水器与折铁烤架包含杯具回收、木材燃料、蒸馏、烤制、收取和过烧；
- 研究后可建造无需燃料、五杯并行的潮镜净水器，三份食物独立火候、共享燃料的三槽烤台，以及支持双向堆叠转移的八格密封干舱；
- 设备附着筏格、玩家碰撞、拆解返还、随筏格落海、状态 HUD 和独立火焰/蒸汽/食物动画；
- 可制作的潮生作物盆，包含共享筏格占位、播种、两阶段浇水、缺水停长、枯萎清理、成熟收获和杯具返还；
- 原创盐翼盗鸟会盘旋、俯冲并啄食作物，玩家可在世界中驱赶；鸟害按停留时间削减果实但保留种子循环；
- 可放置的盐迹研究台：消耗一份实物样本建档，齐集项目需求后手动学习配方，锁定原因在制作页可见；
- 潮红湿砖可在同一通风架分批放置、独立计时与收取；回潮熔炉可在矿石炼锭与细砂熔制玻璃之间切换；
- 金属锭研究会解锁潮铸穿浪矛和宽刃斧；升级消耗旧工具、自动替换快捷栏，并实际提升鲨鱼刺击与砍伐效率；
- 原创程序鲨鱼模型、巡游、预兆、选边、咬筏、结构损伤、分级矛具命中和驱离；
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
- 动态风向、八方帆向、木筏航向、风力利用与航速；舵台提高转向稳定性，正确帆向加快接近，未收帆会加快离流；
- 210 秒确定性海况周期包含积云、强风暴与消散阶段；阵风会造成偏航和帆具载荷，未强化帆过载后自动泄压收紧，避险航线与强化帆可共同降低风险；
- 原创飑云穹顶、GPU 实例化雨幕、双段闪电、风暴雾光、增幅浪高/泡沫/海色和独立风雨雷声层共同表达天气，而非仅改变 HUD 数值；
- 未锚泊浅滩仅短暂停留，玩家离筏后显示离流预警；离流阶段不会被传送回筏，错过追筏窗口后会被留在海中；
- v11 版本化自动存档，新增工具耐久和海面剩余物资，并保存三表面导航、持续世界坐标、信号状态、岛礁节点、逐格筏体、设备、天气、航线及帆锚强化状态，迁移 v1-v10；
- 六总线程序音频混音、随完整相机姿态更新的 HRTF 落水/打捞定位、近场绳索受力与断裂层，以及水下低通、生活/信号设备、锚帆、风雨雷声、种植、研究、礁区和生物声音；
- 标题、HUD、背包、制作、设置、能力提示和 Playwright 截图回归流程；
- 原创标题美术、木材、泡沫、鲨皮、编织纤维、AI 辅助海床、拼补帆布、培养土、耐火陶土、导航合金、信号层压板、磷光玻璃、盐蚀集热玻璃、蜡封帆布 PBR 与飑云天空材质，以及对应的独立 normal/roughness 图。

当前仍不是完整游戏。更多深水生态资源、潜水装备、天气农业、死亡恢复、其余工具耐久、大型信号目的地和最终蒙皮资产仍按 [项目追踪](PROJECT_TRACKER.md) 继续开发。

## 运行

```sh
npm ci
npm run dev -- --port 4173
```

目标环境为带真实 GPU、WebGL2 和键鼠的桌面 Chrome / Edge。当前交互包括：鼠标抛投/刺击/砍伐/建造/开采，`E` 操作设备、打开干舱或拾取资源；注视接收台时 `E` 装入盐差电池/开关机、`R` 调到下一频段、`Shift+R` 调到上一频段；注视舵台时 `E` 切换航线，注视未强化帆/锚且背包有升级件时 `E` 现场加装，注视帆或舵台时 `R` 顺时针调向、`Shift+R` 逆时针调向，注视空熔炉时 `R` 切换矿石/细砂模式；木筏或岛屿上按 `Space` 跳跃，游泳时 `Space` 上浮、`Ctrl` 下潜，数字键切换工具，`I` 或 `Tab` 打开背包，`C` 打开制作。

## 验证

```sh
npm test
npm run build
npm run test:m1-runtime
npm run test:stability
npm run capture
```

截图脚本默认连接 `http://127.0.0.1:4173`，支持 `DRIFTWAKE_URL`、`CHROMIUM_PATH`、`CAPTURE_WIDTH`、`CAPTURE_HEIGHT`、`CAPTURE_QUALITY` 和 `CAPTURE_ONLY`。目标包括 `title`、`pause`、`game`、`hook`、`salvage`、`pack`、`crafting`、`devices`、`advanced`、`signal`、种植/研究/岛屿/水下/导航各主流程、`underwater-narrow`、`narrow`、`settings` 和 `mobile`。`salvage` 会实际近拾海面掉落、触发断钩、制作替代钩并检查手持/抛出模型唯一所有权；`pause` 会模拟 Pointer Lock 拒绝。3D 截图使用分布式 WebGL 像素门禁，拒绝黑屏、白屏、HUD 相交和丢失的上下文。

Termux Chromium 149 的纯 headless 后端会在 WebGL draw call 后首次 readback 时丢失上下文。M1 曾以 Debian Chromium 150 + Xvfb/headful GLES 完成冻结版 1200 秒软件长稳；2026-07-18 当前 Termux 驱动在 headless/headful、GLES/SwiftShader 三条 M2 复验路径均于首帧 Context Lost 或卡住，因此只保留失败证据，不冒充浏览器通过。真实 GPU 的 1280x720/30、1920x1080/60 和 M2 十分钟手感仍是发布门禁。详见 [M1 验收记录](docs/M1_ACCEPTANCE.md) 与 [M2 验收记录](docs/M2_ACCEPTANCE.md)。

## 资产管线

`scripts/imagegen` 会在运行时读取当前 Codex provider 的 `base_url` 与本地认证文件中的 API Key，仓库不会保存服务 URL 或密钥：

```sh
scripts/imagegen generate --prompt "..." --quality high --out output/imagegen/example.png
```

确定性材质兜底和 normal/roughness 派生需要 Pillow：

```sh
python scripts/generate_procedural_materials.py --out-dir public/assets/textures --size 1024
python scripts/derive_material_maps.py --input albedo.webp --normal normal.webp --roughness roughness.webp
python scripts/prepare_imagegen_sail.py --input output/imagegen/sail.png --albedo sail.webp --normal sail-normal.webp --roughness sail-roughness.webp
python scripts/prepare_imagegen_soil.py --input output/imagegen/soil.png --albedo soil.webp --normal soil-normal.webp --roughness soil-roughness.webp
python scripts/prepare_imagegen_material.py --input output/imagegen/material.png --albedo material.webp --normal material-normal.webp --roughness material-roughness.webp
```

完整来源、最终提示词、采用/拒绝结论和模型清单见 [原创资产清单](docs/ASSET_MANIFEST.md)。
