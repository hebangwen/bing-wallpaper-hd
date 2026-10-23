# 设计

Chrome MV3 扩展，零构建，原生 ES Module。各模块职责：

| 模块 | 职责 |
| --- | --- |
| `src/settings.js` | 设置默认值、校验与派生：画质、保留天数、更新时间、地区；历史图画质上限 1080p；下一次运行时间 |
| `src/bing.js` | Bing HPImageArchive 接口，解析归档（保留 `copyrightlink` / `drk`），按画质构造图片 URL |
| `src/network.js` | 统一 `fetch` 超时与重试策略，供 Bing API 和图片下载复用 |
| `src/thumbnail.js` | 在 Service Worker 中用 `OffscreenCanvas` 生成 640px WebP 缩略图；环境不支持时返回 `null`，界面回退原图 |
| `src/tone.js` | 由 `drk` 字段或 32px 采样亮度判定图片色调，驱动新标签页文字配色 |
| `src/store.js` | IndexedDB 缓存：`fetchedAt` / `date` 索引、保留期清理（跳过收藏）、配额淘汰（跳过收藏）、收藏切换、清空 |
| `src/service-worker.js` | 单一同步任务：按设置拉取最近 N 天（当日用所选画质、历史 1080p），逐张入库并生成缩略图，单张失败不阻塞其余；失败时角标 `!` |
| `src/options.*` | 选项页：画质、地区、保留天数、更新时间，缓存统计与清理 |
| `src/popup.*` | 当日壁纸、历史（缩略图）、收藏、保存原图、手动触发、运行状态 |
| `src/top-sites.js` | 将 `chrome.topSites` 原始结果归一化为展示模型：仅保留 http(s)、按域名去重、标题回退域名、限制数量 |
| `src/site-icons.js` | 读取站点声明的 SVG 或高分辨率图标，校验实际像素尺寸，按域名缓存 7 天；缓存按 TTL 和数量上限清理 |
| `src/newtab.*` | 新标签页覆盖（`chrome_url_overrides`）：壁纸、色调自适应、搜索、最常访问站点 |

存储单一真相源：图片记录只存 IndexedDB（`urlbase`、`blob`、`thumb`、`size`、`date`、`fetchedAt`、`favorite`、`title`、`copyright`、`copyrightlink`、`drk`）；`status` 只记录最近一次运行结果；`settings` 存 `chrome.storage.local`；`siteIcons` 存 `chrome.storage.local` 并受 TTL 与数量上限约束。

数据库版本 4：v1→v2 清空重建；v3 增加 `fetchedAt` 索引；v4 增加 `date` 索引。`getLatestImage` 按图片日期而非下载时间取最新，回填多天后仍显示当天壁纸。

回填：Bing 归档一次最多 8 天，`backfillCount` 取保留天数并封顶 8。当日图用设置画质（默认 UHD，约 3.6 MB），历史图压到 1080p（约 0.33 MB），首次安装约 6 MB。已存在且画质一致的图片直接跳过，只补缩略图；旧版本记录没有 `size` 字段，按 UHD 处理避免升级后重复下载。保留期按图片日期（`date`）计算，改小保留天数会立即裁掉超出窗口的历史图。

收藏优先于保留期与配额：`deleteExpiredImages` / `deleteOldestImage` 都跳过 `favorite` 记录，全部为收藏时淘汰返回 `null`。

设置变更：选项页保存后向 Service Worker 发送 `reschedule`，重排 alarm 并按新保留期立即清理；Service Worker 同时监听 `chrome.storage.onChanged` 作为兜底（该事件不负责唤醒 Service Worker）。

可读性：优先用 Bing 返回的 `drk`（1 表示暗图），缺失时采样缩略图平均亮度，阈值 150 判定亮图，CSS 通过 `:root[data-tone="light"]` 切换文字、阴影与搜索框描边。

高清图标需要读取任意最常访问站点的 HTML，`manifest.json` 声明 http/https 主机权限；SVG 不设像素下限，栅格图标至少 40px，低于该尺寸时保留 Chrome favicon。图标按 20px 展示。

测试：`test/*.test.js`（`npm test`），覆盖纯逻辑、基于 `fake-indexeddb` 的存储层，以及用 mock Chrome API 驱动的 Service Worker 同步流程；真实浏览器行为靠手动加载扩展验证。
