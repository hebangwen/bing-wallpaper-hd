# Bing Wallpaper HD

Chrome 扩展：每天自动静默拉取 Bing 每日一图，按显示器原生分辨率（如 4K → UHD 3840×2160）缓存到扩展私有存储（IndexedDB），保留 7 天并自动清理过期图片，不占用下载目录、不触发下载提示。

## 安装

1. `npm run icons` 生成图标（已生成可跳过）
2. Chrome 打开 `chrome://extensions`，开启「开发者模式」
3. 「加载已解压的扩展程序」，选择本目录

设计说明见 [docs/design.md](docs/design.md)。
