# M9 水下礁区与资源材质整改验收

> 状态：`APPROVED`（软件来源、PBR、图集、绑定、交互与 framebuffer 闭环）
> 首次验收版本：`0.22.3`；当前共享图集：`0.22.4`
> 日期：2026-07-22

## 整改范围

本切片回溯 M7 水下内容中长期保留的 `reefRock / coralWarm / coralPale / seaweed / ore / clay / reefFish` 纯色材质，不改动三维游泳、氧气、水中鲨鱼、18 个礁区节点、采集事务或 v18 节点存档真值。

- 永久浸水礁岩与岸上风暴冲刷岩分离；
- 暖枝珊瑚与浅色潮冠珊瑚拥有不同 calcite/孔隙表面；
- 长叶海草使用单层连续组织纹理，不以整片叶轮廓或透明贴片冒充材质；
- 盐壳金属矿、潮红黏土和小型礁鱼分别使用矿物、湿黏土和细鳞语义；
- 既有海床 TEX-005、实例批次、低多边形轮廓与动态焦散保持不变。

## Image 2 资产证据

七张采用源图均由项目 `scripts/imagegen` 读取本地 provider 配置，以 `gpt-image-2 high 2048x2048` 生成并归档到 `artifacts/imagegen/`。首版海草因出现整叶重叠、阴影和空隙被拒绝，同一高质量模型以更严格的“连续单层组织”提示重生成后采用；没有降级模型、尺寸或质量。

| 资产 | 处理 | 接缝结果 |
| --- | --- | --- |
| 浸水礁岩 | 1024，seam 176，normal 0.62，roughness 176-238 | x=`15.26/1.01x`，y=`14.63/0.93x` |
| 暖枝珊瑚 | 1024，seam 168，normal 0.52，roughness 156-220 | x=`17.79/1.07x`，y=`17.67/0.93x` |
| 浅色潮冠珊瑚 | 1024，seam 168，normal 0.54，roughness 166-228 | x=`13.27/0.92x`，y=`13.77/0.94x` |
| 长叶海草 | 1024，seam 168，normal 0.46，roughness 136-208 | x=`13.96/1.01x`，y=`9.61/1.01x` |
| 盐壳金属矿 | 1024，seam 168，normal 0.68，roughness 118-210 | x=`12.82/1.02x`，y=`13.56/0.92x` |
| 潮红礁泥 | 1024，seam 168，normal 0.52，roughness 184-242 | x=`8.14/1.11x`，y=`8.54/0.93x` |
| 盐冠礁鱼皮 | 1024，seam 160，normal 0.42，roughness 112-188 | x=`10.97/0.99x`，y=`9.10/0.88x` |

所有绝对接缝小于 24、相对内部差小于 1.35 倍；七套 albedo/normal/roughness 的 2x2 contact sheet 已人工检查，无硬边、十字带、跨题材轮廓或烘焙光影。完整提示词见 `docs/ASSET_MANIFEST.md` TEX-041 至 TEX-047。

## 纹理预算与双图集

进入水下前的完整运行时基线已经有 30 张 GPU 纹理。若七套 PBR 直接接入 21 张独立运行图，会严重超过 32 张硬预算，因此采用保留分辨率的 guttered 双图集，而不是降低源图或删减通道：

- 审计层继续保留七套独立 1024 albedo/normal/roughness；
- `scripts/build_pbr_atlas.py` 将每套 1024 图缩放到 960 核心，四周各加 32 像素周期 gutter；
- `0.22.4` 运行时 albedo atlas 扩为 4096x3072 RGBA，RGB 保存 albedo、A 精确保存 roughness；
- normal atlas 为独立 4096x3072 RGB；4x3 中除七个水下区域外还容纳结构紧固件、雪松横截面、工具钢和导航合金，并保留一个中性格；
- shader 在 map/normal/roughness 三套 UV 上使用相同 `fract -> scale -> offset`，roughness 明确读取 alpha；
- 七个材质拥有不同 program cache key 和 `pbrAtlasRegion` 诊断，避免程序复用到错误格；
- atlas 生成后逐像素验证保存 alpha 与源 roughness atlas 完全一致；水下仍只消费两张 atlas，`0.22.4` 进一步移除工具钢/导航合金六张独立加载后实测为 `29/32`。

布局、gutter、核心尺寸和 11 组 UV offset/scale 记录在 `artifacts/imagegen/shared-pbr-atlas-layout.json`；七套独立水下审计图仍位于 `artifacts/imagegen/underwater-pbr/`。

## 运行时绑定

- `reefRock`：44 个礁岩实例、海草固着石和矿点基岩；
- `coralWarm / coralPale`：18 簇珊瑚的枝体与芽体实例；
- `seaweed`：34 个环境实例和可收割长叶海草节点；
- `ore`：盐壳金属矿晶体与熔炉待加工矿样，后者直接复用同一材质以保留 atlas shader；
- `clay`：潮红黏土采集节点；
- `reefFish`：三组小型巡游鱼群的躯体与尾鳍；
- `Materials.test.ts` 锁定共享加载路径、七个水下区域、两图复用、alpha roughness 与三套 UV 注入；运行时 dataset 公开 21 个带区域名的语义槽用于浏览器硬门禁。

## 浏览器闭环

复现：

```sh
CAPTURE_ONLY=underwater CAPTURE_FAST=1 npm run capture
CAPTURE_ONLY=underwater-interaction CAPTURE_FAST=1 npm run capture
```

通过结果：

- 21 个 map/normal/roughness 语义槽全部存在且无 `none`，七个区域名逐项匹配；
- `0.22.3` 初始证据为 `32 textures / 118 geometries / 256 calls / 140,650 triangles`；`0.22.4` 删除旧图集与独立合金加载后的复验为 `29 textures / 118 geometries / 255 calls / 140,618 triangles`；
- `contextHealthy=true`、`simulationActive=true`；
- 首轮绑定帧直接画布采样 `variation=127/nonBlack=2880`；共享 4x3 图集复验为 `variation=125/nonBlack=2880`，并继续导出 864x540 WebGL framebuffer；本机 GLES 偶发零帧时仍保留浏览器合成帧回退；
- `underwater-materials-canvas.png` 已人工复核海床、浸水礁岩、两类珊瑚、海草、木筏底面和手持钩具同帧；图集方向正确，无跨格污染、硬缝或纯色回退；
- 交互场景真实识别“收割长叶海草”，按 `E` 后出现 `+2 海草`；合成帧为 `1,146,661` 字节，Context 未丢失；
- 海草首轮场景偏黑后只调整材质乘色并重新取证，Image 2 源图、图集规格和 PBR 通道没有降质。

## 自动验证

```sh
npx vitest run src/game/art/Materials.test.ts --maxWorkers=1
npx vitest run --maxWorkers=1
npm run build
node --check scripts/capture.mjs
python -m py_compile scripts/prepare_imagegen_material.py scripts/build_pbr_atlas.py
git diff --check
```

## 外部门禁

本机 Termux/Xvfb 软件 GLES 不能替代：

- 目标真实 GPU 的 1280x720/30、1920x1080/60 双画质潜水往返与 20 分钟长稳；
- 正午、夜间、风暴、深潜和水面回望时的色调、mip、各向异性与透明排序复核；
- 呼吸、低通、采集、鲨鱼、水流与礁区环境层在真实音频设备上的混音；
- 珊瑚、海草、鱼群、矿点与第一人称钩具的最终 DCC UV、LOD、摆动、受击和收割动画；
- 源图授权、C2PA/生成记录、商标和与商业作品的最终相似性复核。
