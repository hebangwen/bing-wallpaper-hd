# 设计

Chrome MV3 扩展，零构建，原生 ES Module。各模块职责：

| 模块 | 职责 |
| --- | --- |
| `src/settings.js` | 设置默认值与校验：画质（预设或自定义宽高）、保留天数、更新时间、地区、图源、日期时间显示、模糊/暗化/毛玻璃；历史图画质上限 1080p；下一次运行时间 |
| `src/bing.js` | Bing HPImageArchive 接口，解析归档（保留 `copyrightlink` / `drk`）；预设画质用原生资源，自定义宽高走 `&w=&h=&rs=1&c=4` 服务端缩放 |
| `src/sources/*` | 图源适配层：Bing 归档、Wikimedia 每日图片（英文/中文，下载 1920px 缩略图）；统一返回 `urlbase`、`downloadUrl`、`source` |
| `src/i18n.js` | `chrome.i18n` 封装：读取文案、按 `data-i18n` 填充 HTML、返回当前 UI 语言 |
| `src/network.js` | 统一 `fetch` 超时与重试策略，供 Bing API 和图片下载复用 |
| `src/thumbnail.js` | 在 Service Worker 中用 `OffscreenCanvas` 生成 640px WebP 缩略图；环境不支持时返回 `null`，界面回退原图 |
| `src/clock.js` | 日期与时间的纯格式化函数：12/24 小时制、是否带秒、完整/数字日期 |
| `src/pin.js` | 固定壁纸：读写 `pinnedUrlbase`，固定图缺失时回退最新壁纸，生成带「已固定」前缀的说明文字 |
| `src/tone.js` | 由 `drk` 字段或 32px 采样亮度判定图片色调，驱动新标签页文字配色 |
| `src/store.js` | IndexedDB 缓存：`fetchedAt` / `date` 索引、保留期清理（跳过收藏）、配额淘汰（跳过收藏）、收藏切换、清空 |
| `src/service-worker.js` | 单一同步任务：按设置的图源拉取最近 N 天（Bing 当日用所选画质、历史 1080p，其它源用原图/1920px），逐张入库并生成缩略图，单张失败不阻塞其余；失败时角标 `!` |
| `src/options.*` | 选项页：图源、画质（含自定义宽高）、地区、保留天数、更新时间、日期时间、模糊/暗化/毛玻璃与实时预览、缓存统计与清理 |
| `src/popup.*` | 当日壁纸、历史（缩略图）、收藏、固定、保存原图、手动触发、运行状态 |
| `src/top-sites.js` | 将 `chrome.topSites` 原始结果归一化为展示模型：仅保留 http(s)、按域名去重、标题回退域名、限制数量 |
| `src/site-icons.js` | 读取站点声明的 SVG 或高分辨率图标，校验实际像素尺寸，按域名缓存 7 天；缓存按 TTL 和数量上限清理 |
| `src/newtab.*` | 新标签页覆盖（`chrome_url_overrides`）：壁纸（优先固定图）、模糊/暗化/毛玻璃、时钟、色调自适应、搜索、最常访问站点 |

存储单一真相源：图片记录只存 IndexedDB（`urlbase`、`blob`、`thumb`、`size`、`date`、`fetchedAt`、`favorite`、`title`、`copyright`、`copyrightlink`、`drk`）；`status` 只记录最近一次运行结果；`settings` 与 `pinnedUrlbase` 存 `chrome.storage.local`；`siteIcons` 存 `chrome.storage.local` 并受 TTL 与数量上限约束。

固定壁纸：`pinnedUrlbase` 指向某条图片记录，新标签页优先展示它并加「已固定」前缀；固定时自动置 `favorite`，复用「收藏免清理」的保护链，取消收藏会同时解除固定。固定图被手动清除后，新标签页回退最新壁纸并自动清除失效指针。

数据库版本 4：v1→v2 清空重建；v3 增加 `fetchedAt` 索引；v4 增加 `date` 索引。`getLatestImage` 按图片日期而非下载时间取最新，回填多天后仍显示当天壁纸。

回填：Bing 归档一次最多 8 天，`backfillCount` 取保留天数并封顶 8。当日图用设置画质（默认 UHD，约 3.6 MB），历史图压到 1080p（约 0.33 MB），首次安装约 6 MB。已存在且画质一致的图片直接跳过，只补缩略图；旧版本记录没有 `size` 字段，按 UHD 处理避免升级后重复下载。保留期按图片日期（`date`）计算，改小保留天数会立即裁掉超出窗口的历史图。

收藏优先于保留期与配额：`deleteExpiredImages` / `deleteOldestImage` 都跳过 `favorite` 记录，全部为收藏时淘汰返回 `null`。

设置变更：选项页保存后向 Service Worker 发送 `reschedule`，重排 alarm 并按新保留期立即清理；Service Worker 同时监听 `chrome.storage.onChanged` 作为兜底（该事件不负责唤醒 Service Worker）。

可读性：优先用 Bing 返回的 `drk`（1 表示暗图），缺失时采样缩略图平均亮度，阈值 150 判定亮图，CSS 通过 `:root[data-tone="light"]` 切换文字、阴影与搜索框描边。

日期时间：`clock.js` 只负责纯格式化，新标签页按设置渲染并每秒对齐整秒刷新，页面关闭时清理定时器；`chrome.storage.onChanged` 让设置改动在当前标签页立即生效。时钟不发起网络请求。

壁纸效果：模糊与暗化写成 CSS 变量（`--wallpaper-blur`、`--wallpaper-dim`、`--wallpaper-scale`），模糊时同步放大避免边缘透出；暗化用 `body::after` 覆盖层；毛玻璃由 `data-glass="on"` 打开，通过 `body::before` 的 `backdrop-filter` 为整页叠加磨砂层，内容保持清晰。选项页用缩略图做同款预览。

多图源：`SOURCES` 暴露 `listImages()` 与 `imageUrl()`，Bing 走 `urlbase + 画质后缀`，Wikimedia 走每日 feed 并把 `thumbnail` 升到 1920px，避免下载几十 MB 原图。切换图源会删除其它源且未收藏的图片，保证新标签页展示的是当前源。

多语言：所有界面文案集中在 `_locales/zh_CN` 与 `_locales/en`，HTML 用 `data-i18n*` 标记，JS 通过 `t()` 读取；manifest 的 `name` / `description` 使用 `__MSG_*__`。日期用 `Intl.DateTimeFormat` 按 UI 语言格式化，上午/下午来自文案表。

高清图标需要读取任意最常访问站点的 HTML，`manifest.json` 声明 http/https 主机权限；SVG 不设像素下限，栅格图标至少 40px，低于该尺寸时保留 Chrome favicon。图标按 20px 展示。

测试：`test/*.test.js`（`npm test`），覆盖纯逻辑、基于 `fake-indexeddb` 的存储层，以及用 mock Chrome API 驱动的 Service Worker 同步流程；真实浏览器行为靠手动加载扩展验证。
