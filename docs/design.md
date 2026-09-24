# 设计

Chrome MV3 扩展，零构建，原生 ES Module。各模块职责：

| 模块 | 职责 |
| --- | --- |
| `src/bing.js` | Bing HPImageArchive 接口，返回当日图片元数据 |
| `src/resolution.js` | 分辨率梯队定义与选择策略（能覆盖设备物理像素的最小尺寸）、URL 与文件名构造 |
| `src/store.js` | 图片缓存层：IndexedDB（扩展私有，Blob 原生存储），定义 7 天保留策略 `RETENTION_MS` 与过期清理 |
| `src/background.js` | Service Worker：每日 6:00 `chrome.alarms` + 启动/安装时静默拉取（`fetch` → Blob → `store.js`），经 offscreen 文档读取屏幕物理像素（`screen × devicePixelRatio`，`chrome.system.display` 在 macOS 拿不到原生像素），按 `urlbase` 去重，每次拉取后清理过期缓存 |
| `src/offscreen.*` | 离屏文档，向 Service Worker 提供 DOM 环境下的屏幕物理分辨率 |
| `src/popup.*` | 从缓存渲染当日壁纸与近 7 天历史，展示状态与手动触发入口 |
| `src/newtab.*` | 新标签页覆盖（`chrome_url_overrides`），全屏展示缓存中最新的壁纸；缓存为空时触发一次拉取 |

状态单一真相源：图片缓存在 IndexedDB（见 `src/store.js`），运行状态在 `chrome.storage.local`（`status`），popup 只读渲染。

测试：`test/resolution.test.js`（`npm test`），仅覆盖纯逻辑，Chrome API 层靠真实环境验证。
