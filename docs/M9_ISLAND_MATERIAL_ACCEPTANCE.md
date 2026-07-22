# M9 岛屿与岸上资源材质整改验收

> 状态：`APPROVED`（软件来源、PBR、绑定、交互与 framebuffer 闭环）
> 版本：`0.22.2`
> 日期：2026-07-22

## 整改范围

本切片回溯 M4/M7 岛屿内容中长期保留的 `leaf / rock / foliage / darkWood` 纯色或跨题材复用问题，不改动岛屿生成、资源生命、砍伐事务、地形碰撞和存档真值。

- 岛屿岩石与石料使用独立风暴冲刷岛岩 PBR；
- 棕榈树干与树桩不再复用木筏雪松，改用独立盐冠树皮 PBR；
- 棕榈叶、灌木、纤维簇和纤维漂流物共享同一植物语义 PBR，但保留不同材质色调；
- 野生潮果使用独立果皮 PBR，不再用叶材质，也不复用 M6 作物盆果实；
- 高度场新增 UV 与岸滩微表面 PBR，原有顶点色仍控制沙地、旱草、绿地、岩区和浸水带的大尺度颜色；
- 远景沙洲使用同一岸滩语义，远景/可探索岛不再发生材质割裂。

## Image 2 资产证据

| 资产 | 请求 | 处理 | 接缝结果 |
| --- | --- | --- | --- |
| 风暴冲刷岛岩 | `gpt-image-2 high 2048x2048` | 1024，seam 160，normal 0.62，roughness 176-238 | x=`9.38/0.96x`，y=`12.74/0.88x` |
| 盐冠棕榈树皮 | `gpt-image-2 high 2048x2048` | 1024，seam 176，normal 0.66，roughness 184-242 | x=`20.48/0.97x`，y=`10.97/1.03x` |
| 盐冠棕榈叶面 | `gpt-image-2 high 2048x2048` | 1024，seam 168，normal 0.52，roughness 148-220 | x=`8.16/1.09x`，y=`17.91/0.91x` |
| 野生潮果果皮 | `gpt-image-2 high 2048x2048` | 1024，seam 160，normal 0.42，roughness 116-188 | x=`11.43/1.09x`，y=`9.29/0.90x` |
| 盐冠岸滩地表 | `gpt-image-2 high 2048x2048` | 1024，seam 168，normal 0.54，roughness 184-242 | x=`18.08/1.14x`，y=`19.56/1.15x` |

五张采用源图均归档在 `artifacts/imagegen/`；15 张派生 albedo/normal/roughness 通过 2x2 人工检查。完整提示词、文件名与用途见 `docs/ASSET_MANIFEST.md` TEX-036 至 TEX-040。

## 纹理预算与通道打包

五套独立三图首次接入后，岛屿场景为 `33` 张 GPU 纹理，超过既定上限 32，因此没有通过抬高预算完成验收。

`scripts/pack_roughness_alpha.py` 将岸滩 roughness 逐像素写入同一张 albedo 的 alpha：

```sh
python scripts/pack_roughness_alpha.py \
  --albedo artifacts/imagegen/saltcrown-shore-ground-albedo-1024.webp \
  --roughness artifacts/imagegen/saltcrown-shore-ground-roughness-1024.webp \
  --output public/assets/textures/saltcrown-shore-ground-packed.webp \
  --quality 92
```

- packed 图保持 1024x1024 RGBA；
- alpha 极值为 `187-218`，与派生 roughness 的像素差为空；
- `MeshStandardMaterial` 仍拥有 albedo、normal、roughness 三个材质槽，roughness shader 改读 alpha；
- 地形与远景沙洲克隆材质时显式保留同一 shader cache key，避免退回绿色通道；
- 最终浏览器帧为 `32/32` 纹理，没有删除、降清或错误复用任何 PBR 信息。

## 运行时绑定

- `rock`：岛岩三图，覆盖地标岩、石堆和石质工具部件；
- `palmBark`：树皮三图，覆盖远近棕榈、采集树干和树桩；
- `leaf / foliage`：共享叶面三图，以不同乘色表达纤维叶与常绿植被；
- `tidefruitSkin`：果皮三图，覆盖冠层和落地潮果；
- `shoreGround`：packed albedo/roughness + normal，覆盖高度场和远景沙洲；
- `Materials.test.ts` 锁定加载路径、PBR 绑定与 packed roughness 复用；`ProceduralModels.test.ts` 锁定高度场 UV 数量、地表 map 和棕榈树皮/果皮实例绑定。

## 浏览器闭环

复现：

```sh
CAPTURE_ONLY=island CAPTURE_FAST=1 npm run capture
```

通过结果：

- 15 个语义材质槽全部存在，岸滩 roughness 明确绑定 packed alpha；
- `renderer.info.memory.textures=32`、geometries=`193`、draw calls=`165`、triangles=`87,520`；
- `contextHealthy=true`、`simulationActive=true`；
- 直接画布采样 `variation=234`、`nonBlack=2763`，没有使用空 X11 合成层冒充内容；
- `island-materials-canvas.png` 为 864x540 WebGL framebuffer 直读，已人工复核树皮、叶片、潮果、岛岩、地表、斧具和海面同帧构图；
- `CAPTURE_ONLY=island-interaction CAPTURE_FAST=1` 继续识别“拾取风干枝料”，真实 `E` 结算后画布 `variation=240/nonBlack=2774`；
- 原有岛屿交互、节点实例化、地形碰撞和资源生成未因材质拆分改变。

## 自动验证

```sh
npx vitest run src/game/art/Materials.test.ts src/game/art/ProceduralModels.test.ts --maxWorkers=1
npx vitest run --maxWorkers=1
npm run build
node --check scripts/capture.mjs
python -m py_compile scripts/prepare_imagegen_material.py scripts/pack_roughness_alpha.py
git diff --check
```

## 外部门禁

本机 Termux/Xvfb 软件 GLES 不能替代：

- 目标真实 GPU 的 1280x720/30、1920x1080/60 双画质岛屿往返；
- 正午、夜间、风暴和水下望岸时的材质色调与 mip/各向异性复核；
- 砍伐、拾取、岸浪、鸟声与岛屿环境层在真实音频设备上的混音；
- 棕榈、灌木、石块、果实与工具的最终 DCC UV、LOD、风摆和受击动画；
- 源图授权、C2PA/生成记录、商标和与商业作品的最终相似性复核。
