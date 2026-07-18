# M2 漂流物、钩具与拾取验收记录

> 更新日期：2026-07-18  
> 当前结论：领域、存档、构建与浏览器用例代码已闭环；目标真实 GPU 的十分钟手感和画面证据待执行，因此 M2 保持 `DOING`。

## 已实现范围

- 五类固定种子漂流物：漂木、聚合容器、纤维叶、盐封补给箱、三箍补给桶；
- 蓄力、抛射、绳索、碰撞、拖回与近距 `E` 拾取共享同一战利品结算器；
- 背包部分接收后，拒收内容保留在八槽池化海面掉落中；池满时合并而不丢失；
- 打捞钩 48 次抛投耐久、HUD 耐久条、断裂移除、近拾软锁保护和替代钩制作恢复；
- v11 保存工具耐久和最多八份海面掉落，并迁移 v1-v10；
- `CAPTURE_ONLY=salvage` 覆盖近拾、断钩、替代钩制作，以及手持/抛出模型唯一所有权。

## 自动证据

```sh
npm test
npm run build
git diff --check
node --check scripts/capture.mjs
```

2026-07-18 本环境结果：

- Vitest：28 个测试文件、147 项通过；
- 600 秒、36,000 固定步、30 个漂流物压力用例通过；活动预算保持 30，位置均为有限值，没有掉落池泄漏；
- 生产构建通过：CSS 64.40 kB、主入口 302.07 kB、3D chunk 877.07 kB、Rapier 2,237.42 kB；
- Rapier 继续保持独立 chunk，标题页延迟加载边界未改变。

## 当前浏览器阻塞

本轮没有把软件渲染失败记为玩法通过：

1. Xvfb headful GLES，1440x900/high：GPU 线程持续占用且六分钟无首个用例输出，人工终止；
2. headless SwiftShader，1440x900/high：首帧 `ReadPixels` 后 `CONTEXT_LOST_WEBGL`；
3. headless GLES，960x600/low：降至 168 calls、66,858 triangles 后仍在首帧 `CONTEXT_LOST_WEBGL`；
4. Xvfb headful SwiftShader，960x600/low：同样在首帧 `CONTEXT_LOST_WEBGL`。

低画质复现仍失败，说明当前证据不足以把问题归因于新增补给桶或近拾模型预算。M1 已冻结的软件长稳结果仍有效，但不能替代本轮 M2 场景和真实 GPU。

## 目标 GPU 复验

```sh
npm run preview -- --host 0.0.0.0 --port 4180
CAPTURE_ONLY=salvage DRIFTWAKE_URL=http://127.0.0.1:4180 npm run capture
```

必须同时满足：

- 近距散落物资出现世界聚焦环和 `E` 提示，拾取后库存增加且世界掉落归零；
- 1 点耐久钩抛出后断裂，手持钩立即隐藏，飞行钩和绳索仍完成当前动作；
- 制作替代钩后耐久恢复为 48/48，抛出模型回收前不得同时显示手持模型；
- `salvage-pickup-desktop.png` 与 `salvage-recovery-desktop.png` 非黑屏、非白屏、HUD 无遮挡；
- 手工连续钩取十分钟，无物资消失、重复模型、交互所有权抢占或不可恢复断钩；
- 最终双手抓握/放绳/收绳和空间音频完成后，再把 M2 标记为 `DONE`。
