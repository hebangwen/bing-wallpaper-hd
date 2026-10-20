# 设计

Chrome MV3 扩展，零构建，原生 ES Module。各模块职责：

| 模块 | 职责 |
| --- | --- |
| `src/bing.js` | Bing HPImageArchive 接口，校验并返回当日图片元数据，并构造 UHD 图片 URL |
| `src/network.js` | 统一 `fetch` 超时与重试策略，供 Bing API 和图片下载复用 |
| `src/store.js` | 图片缓存层：IndexedDB（扩展私有，Blob 原生存储），定义 7 天保留策略 `RETENTION_MS`、`fetchedAt` 索引、最新图片查询、批量过期清理与最旧图片淘汰 |
| `src/service-worker.js` | Service Worker：每日 6:00 `chrome.alarms` + 启动/安装时静默拉取 UHD，按 `urlbase` 去重；同一下载任务单飞，下载前清理过期缓存，配额不足时淘汰最旧图片后重试 |
| `src/popup.*` | 从 IndexedDB 派生当日壁纸与近 7 天历史，支持历史预览，展示运行状态与手动触发入口 |
| `src/top-sites.js` | 将 `chrome.topSites` 原始结果归一化为展示模型：仅保留 http(s)、按域名去重、标题回退域名、限制数量 |
| `src/site-icons.js` | 读取站点声明的 SVG 或高分辨率图标，校验实际像素尺寸，按域名缓存 7 天；缓存按 TTL 和数量上限清理 |
| `src/newtab.*` | 新标签页覆盖（`chrome_url_overrides`），通过 `fetchedAt` 索引读取最新壁纸并展示最常访问站点；图标先渲染 Chrome favicon，再异步替换为高清图标，壁纸缓存为空时触发一次拉取 |

状态单一真相源：图片及元数据只存 IndexedDB（见 `src/store.js`）；`status` 仅记录最近一次运行结果，不复制壁纸元数据；`siteIcons` 存于 `chrome.storage.local` 并受 TTL 与数量上限约束。popup 的展示内容从 IndexedDB 派生。

高清图标需要读取任意最常访问站点的 HTML，`manifest.json` 声明 http/https 主机权限；SVG 不设像素下限，栅格图标至少 40px，低于该尺寸时保留 Chrome favicon。图标按 20px 展示。

测试：`test/*.test.js`（`npm test`），覆盖纯逻辑与基于 `fake-indexeddb` 的存储层；Chrome API 层靠真实环境验证。
