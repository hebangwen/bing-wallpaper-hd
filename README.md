# Bing Wallpaper HD

Chrome 扩展：每天自动静默拉取 Bing 每日一图 UHD（3840×2160），缓存到扩展私有存储（IndexedDB），保留 7 天并自动清理过期图片，不占用下载目录、不触发下载提示。新标签页同时展示最常访问站点，优先使用站点声明的高清或 SVG 图标，其余回退到 Chrome favicon。

## 安装

1. `npm run icons` 生成图标（已生成可跳过）
2. Chrome 打开 `chrome://extensions`，开启「开发者模式」
3. 「加载已解压的扩展程序」，选择本目录

设计说明见 [docs/design.md](docs/design.md)。
