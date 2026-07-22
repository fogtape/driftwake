# M9 结构与防御材质整改验收

> 日期：2026-07-23
> 版本：`0.22.4`
> 状态：`APPROVED`（软件 WebGL 逻辑、材质绑定、资源预算与构图闭环；目标真实 GPU 双画质仍属发布门禁）

## 本轮范围

- 保留已经通过验收的风化雪松、潮缚索具和盐蚀工具钢，不为追求数量重复生成同语义资产；
- 为筏体钉件、结构连接件、潮兜卡扣和缘甲角固件新增专用“风暴撑紧固合金” PBR；
- 为临界受损结构新增专用“风暴伤雪松横截面” PBR，并用真实缺损端面取代单纯整体染色；
- 将盐蚀工具钢和盐蚀导航合金并入共享图集，抵消新结构材质的 GPU 纹理成本；
- 不改变结构生命、鲨鱼伤害、修补量、材料消耗、坍塌事务或 v18 存档 schema。

## Image 2 来源与采用结论

两张采用源均由项目 `scripts/imagegen` 读取本地 provider 配置，通过以下固定请求生成：

```sh
scripts/imagegen generate --model gpt-image-2 --quality high --size 2048x2048 \
  --prompt-file tmp/imagegen/stormbrace-fastener.txt \
  --out output/imagegen/stormbrace-fastener-alloy.png --force --no-augment
scripts/imagegen generate --model gpt-image-2 --quality high --size 2048x2048 \
  --prompt-file tmp/imagegen/stormscar-cedar-crosscut.txt \
  --out output/imagegen/stormscar-cedar-crosscut.png --force --no-augment
```

采用源归档为：

- `artifacts/imagegen/stormbrace-fastener-alloy-raw.png`；
- `artifacts/imagegen/stormscar-cedar-crosscut-raw.png`。

拒绝记录：

- 紧固合金首版呈深色板岩断裂，材质语义错误；第二版虽为金属但过于均匀，缩小到卡扣后缺少可读层次；采用版改为中亮度冷枪灰、旧镍磨耗、浅锤击和克制盐蚀；
- 横截面首版形成 OSB/木屑拼堆，无法表达连续承力木；采用版保持单一浅蜂蜜色雪松横切面、细年轮弧和少量纤维撕裂；
- 被拒绝候选没有进入归档、图集或运行时，也没有通过降低模型、分辨率或质量参数规避问题。

## PBR 派生与平铺门禁

| 材质 | 派生参数 | 接缝结果 | 视觉结论 |
| --- | --- | --- | --- |
| 风暴撑紧固合金 | 1024、seam 168、normal 0.56、roughness 132-210、boundary 优化 | x=`8.58/1.13x`、y=`9.26/0.93x`、boundary=`(1,1023)` | 2x2 无硬缝；冷枪灰、镍磨耗和少量氧化在小卡扣上可辨，不像石材或导航长拉丝合金 |
| 风暴伤雪松横截面 | 1024、seam 168、normal 0.64、roughness 182-242、boundary 优化 | x=`6.45/1.11x`、y=`9.26/0.95x`、boundary=`(1,1)` | 2x2 连续；浅色横切年轮与既有纵向筏板纹理明确分离，无 OSB、木屑堆或完整木板轮廓 |

独立审计图位于 `artifacts/imagegen/structure-pbr/`。原图、派生图和 2x2 预览均经过人工检查，数值门禁仍为绝对差 `<=24`、相对内部差 `<=1.35x`。

## 共享图集与预算

`scripts/build_pbr_atlas.py` 现支持多个输入目录，并要求每个名称只命中一套完整 albedo/normal/roughness 源。当前共享图集为 4096x3072、4x3 格：

- 七个水下材质区域；
- 风暴撑紧固合金；
- 风暴伤雪松横截面；
- 已批准的盐蚀工具钢；
- 已批准的盐蚀导航合金；
- 一个保留空格。

每格仍为 1024，包含 960 核心和四周 32 像素周期 gutter。RGB 保存 albedo、A 保存 roughness，normal 使用第二张图集；生成器会逐像素检查 roughness alpha。布局记录在 `artifacts/imagegen/shared-pbr-atlas-layout.json`。

工具钢和导航合金三图已从运行目录移至 `artifacts/imagegen/shared-pbr-sources/`，旧 4096x2048 水下图集已删除。使用新审计目录重建后，两张图集 SHA-256 与迁移前完全一致，证明没有重采样或降质：

- packed atlas：`14973b1084d6932ec2093a4c1d765b876e2978cb4686537d87a9f6fa9e6013bc`；
- normal atlas：`f3fcd6bc6bf9e938139fdf0561422b7e7b841b4e8c36a0db8f4bf7ff4384a450`。

## 运行时接线

- `RaftStructureSystem` 的金属实例、`StructureCollapseSystem` 的坠落金属、潮兜合批卡扣、筏格钉件和缘甲角固件统一使用 `structureFastener`；
- 缘甲长导轨继续使用材质语义正确的 `navigationAlloy`，没有为了省预算把两种金属强行同色；
- 临界结构会确定性选择一个足够大的木质箱形分件，缩短该分件并在真实缺损端生成一层薄横截面实例；完整/普通受损状态数量为 0，临界状态每件最多 1 个；
- 结构静态批次上限由七个基础批次扩为“七个基础批次 + 一个有界横截面批次”。横截面使用固定容量 `InstancedMesh`，没有逐帧创建 geometry、material 或 texture；
- `structureMaterialMaps`、`structureCrosscutCount` 和 `raftDefenseMaterialMaps` 将材质区域、槽位数量和横截面真值暴露给浏览器门禁。

## 浏览器证据

```sh
CAPTURE_ONLY=building BUILDING_PART=damage CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=perimeter-defense-visual CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=underwater CAPTURE_FAST=1 npm run capture
```

- 结构损坏/修复：鲨鱼真实双咬 `75 -> 41 -> 7`，冷启动恢复后横截面数量为 1，18 个材质槽完整；renderer 为 `30 textures / 79 geometries / 110 calls / 113,924 triangles`。三锤真实修补 `7 -> 51 -> 95 -> 110`，漂木 `12 -> 9`、锤耐久 `80 -> 77`，最终损坏/临界/横截面均归零；
- 周界防御：三块缘甲与载货潮兜保持筏体局部附着，护栏/紧固件六个 PBR 槽分别命中 `navigation-alloy` 和 `stormbrace-fastener-alloy`；renderer 为 `30 textures / 88 geometries / 129 calls / 105,592 triangles`；
- 水下回归：删除旧图集后七个区域的 21 个槽仍全部绑定共享图集，renderer 从 `32` 降为 `29 textures`，其余为 `118 geometries / 255 calls / 140,618 triangles`，画布像素 `variation=125/nonBlack=2880`；
- `structure-materials-canvas.png`、`perimeter-materials-canvas.png` 和 `underwater-materials-canvas.png` 已人工复核。结构帧可见被截短的前向木板、缺口与浅色新鲜断面边，周界帧可见深色护栏与灰色夹具，水下材质没有区域串行或 UV 错位；
- 软件环境中连续维修的等待从 450ms 调到 900ms，以覆盖正式 `0.34s` 锤击锁在低帧率下的模拟推进；玩法锁、修复值和资源结算均未放宽。收集网瞄准改为三高度采样并输出完整失败诊断，仍通过真实鼠标移动与真实交互提示。

## 自动验证

```sh
npm test
npm run build
node --check scripts/capture.mjs
python -m py_compile scripts/prepare_imagegen_material.py scripts/build_pbr_atlas.py
git diff --check
```

结构系统新增“临界横截面出现、修复后归零”测试；材质测试覆盖 11 个 atlas 区域的唯一 program cache key、工具钢/导航合金共享绑定和 roughness alpha shader。目标真实 GPU 的 1280x720/30、1920x1080/60、风暴夜间金属响应、长时间扩建和最终 DCC/LOD 仍保留为 M9 发布门禁。
