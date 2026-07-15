# Driftwake

原创网页 3D 海上生存游戏，目前处于高质量纵向切片阶段。

## 当前内容

- 原创标题主视觉、木材纹理与定向海面泡沫遮罩；
- Three.js 程序化海面、天空、远景岛和昼光氛围；
- 带波浪升沉的 3x3 木筏与第一人称键鼠移动；
- 木料、聚合片、纤维和补给箱漂流物；
- 蓄力抛钩、飞行、绳索、入水、命中、拖回和收获流程；
- 程序化分层海浪、风声、木筏吱响、抛钩、落水和收获音效；
- 标题界面、HUD、快捷栏、设置与移动设备能力页；
- Rapier 物理初始化、Vitest 逻辑测试和 Playwright 截图脚本。

当前实现不是完整游戏。建造、鲨鱼、钓鱼、岛屿探索、研究与存档仍按追踪文档继续开发。

## 运行

```sh
npm install
npm run dev
```

默认地址由 Vite 输出。桌面 Chrome / Edge、键鼠与 WebGL2 是当前目标环境。

## 验证

```sh
npm test
npm run build
npm run capture
```

`npm run capture` 默认连接 `http://127.0.0.1:4173`，可通过 `DRIFTWAKE_URL`、`CHROMIUM_PATH`、`CAPTURE_WIDTH` 和 `CAPTURE_HEIGHT` 调整。

## 图像生成

`scripts/imagegen` 会在运行时读取：

- `$CODEX_HOME/config.toml` 中当前 provider 的 `base_url`；
- `$CODEX_HOME/auth.json` 中的 `OPENAI_API_KEY`。

仓库不保存密钥。示例：

```sh
scripts/imagegen generate --prompt "..." --quality high --out output/imagegen/example.png
```

## 文档

- [项目追踪](PROJECT_TRACKER.md)
- [原创资产清单](docs/ASSET_MANIFEST.md)

