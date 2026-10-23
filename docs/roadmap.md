# 功能扩展分析

基于当前代码（v1.1.3，26 个测试全绿）盘点实现边界，给出可加功能、落点文件与优先级。

## 1. 现状

已具备：Bing 每日一图 UHD 静默下载（IndexedDB 缓存 7 天）、新标签页壁纸 + 三引擎搜索 + 最常访问站点 + 高清站点图标、popup 当日壁纸 / 历史预览 / 手动触发 / 运行状态。

架构约束（决定了新功能怎么加）：

- 零构建、原生 ES Module；`bing.js` / `network.js` / `store.js` 是纯逻辑层，可测试；Chrome API 只在 `service-worker.js`、`newtab.js`、`popup.js`、`site-icons.js` 出现。
- 单图源硬编码：`API_URL` 写死 `mkt=zh-CN`、`idx=0&n=1`；`buildWallpaperUrl` 写死 `_UHD.jpg`。
- 配置几乎全是常量：`RETENTION_MS`（7 天）、`retryDelaysMs`、6:00 闹钟、引擎列表、站点数量 10。
- 设置只存 `chrome.storage.local`（`searchEngine`、`status`、`siteIcons`），没有 options 页，没有同步。

## 2. 实测数据（本次验证）

| 项目 | 结果 |
| --- | --- |
| `n=8` | 支持，一次可拿最近 8 天 |
| `idx` | 0–7 可用（配合 `n=8`） |
| `mkt` | 同一天图片相同，但标题/版权文案随地区变化（zh-CN「飞掠河面」vs en-US「Winging it over the river」） |
| `_UHD.jpg` | 3.67 MB / 3840×2160 |
| `_1920x1200.jpg` | 0.99 MB |
| `_1920x1080.jpg` | 0.33 MB |
| `_1366x768.jpg` | 0.17 MB |
| `_1080p.jpg` / `_720p.jpg` | 无效（返回 1.2 KB 占位图） |
| 7 天 UHD 缓存 | ≈ 26 MB（解码后的位图内存更高） |
| API 额外字段 | `copyrightlink`、`quiz`、`hsh`、`drk`、`wp` 等，`parseDailyImage` 目前全部丢弃 |

## 3. 主要差距（v1.2 前）

1. **只有"今天"**：`n=1` + `idx=0`，新装用户历史为空，要攒 7 天才好看。这是投入产出比最高的一项。
2. **popup 用 UHD 原图当缩略图**：`popup.js` 直接给历史项 44px 高的 `<img>` 挂 `blob:` 的 3840×2160 原图，7 张就是 200 MB+ 解码量，弹窗会卡、内存会涨。
3. **没有设置入口**：保留天数、画质、地区、更新时刻、开关都改不了。
4. **壁纸只能看**：不能收藏、不能保存、不能查看拍摄地/作者。
5. **新标签页信息密度低**：只有搜索 + 站点；亮色壁纸下 `#caption` 的白字 + 阴影可读性不稳。
6. **商店与隐私风险**：`host_permissions` 全量 `http://*/*`、`https://*/*`，只为抓站点图标；无 i18n，无隐私说明。

## 4. 功能池

成本口径：S < 0.5 天，M 1–2 天，L ≥ 3 天（单人）。

### A. 壁纸管线

| 功能 | 成本 | 落点与要点 |
| --- | --- | --- |
| 历史回填最近 7 天 | S | `bing.js` 增加 `fetchArchive({ n, mkt })`；`service-worker.js` 安装时 `n=8&idx=0` 批量入库。建议历史用 `_1920x1080`（0.33 MB），仅当日用 UHD，否则首次安装就写 26 MB+ |
| 画质档位 | S | `buildWallpaperUrl(urlbase, size)`，尺寸取 `UHD / 1920x1200 / 1920x1080 / 1366x768`；默认 UHD，设置里可降至 1080p 省空间 |
| 缩略图缓存 | M | 入库时用 `createImageBitmap` + `OffscreenCanvas` 生成 480px WebP（SW 支持），存 `thumb` 字段；popup 历史用 `thumb`，详情用原图。DB 升 v4，旧数据惰性补图 |
| 收藏 / 固定 | S | 记录加 `favorite: true`；`deleteExpiredImages`、`deleteOldestImage` 跳过收藏；加数量上限（如 50）防止撑爆配额 |
| 保存到本地 | S | `chrome.downloads.download`（需 `downloads` 权限）或页面内 `<a download>`（免权限）；文件名 `bing-20261020-标题.jpg` |
| 失败退避 + 角标 | S | 失败时 `chrome.action.setBadgeText("!")`；按连续失败次数排 30min/2h 重试闹钟；成功清除 |
| 多图源 | L | 抽 `src/sources/`：`{ id, label, fetchDaily() }`，接入 NASA APOD、Unsplash、Wikimedia POTD；记录加 `source` 字段，设置里选源或配 fallback 链 |
| 地区 / 文案语言 | S | `mkt` 可配置（zh-CN / en-US / ja-JP…），影响标题与版权文案；顺带解决 caption 只有中文的问题 |
| 过期/离线提示 | S | caption 显示"N 天前"；当前静默展示旧图，用户不知道已过期 |

### B. 新标签页体验

| 功能 | 成本 | 落点与要点 |
| --- | --- | --- |
| 可读性自适应 | S | API 已返回 `drk`（暗图标记），按它切浅/深文字 + 渐变遮罩；比现场采样图片亮度省事。现有 `#caption` 的 `text-shadow` 只覆盖一种情况 |
| 详情 / 拍摄地 | S | 扩展 `parseDailyImage` 保留 `copyrightlink`、`quiz`、`hsh`；点标题打开 Bing 关于该地的搜索或每日问答 |
| 时钟 / 日期 / 问候 | S | 纯前端组件，可开关；农历需引库，权衡体积 |
| 轮播 / 随机 / 下一张 | M | 已有 7 张缓存，定时切换或每次新标签随机；配淡入过渡，注意 `prefers-reduced-motion` |
| 效果设置 | S | 模糊、暗化强度、Ken Burns 缓动、淡入；全部落到 CSS 变量，避免改选择器 |
| 自定义快捷方式 | M | 在 `topSitesFrom` 结果上合并用户配置（增/删/置顶/拖拽排序），存 `settings.shortcuts`；`top-sites.js` 加纯函数并补测试 |
| 右键 / 长按菜单 | S | 保存、复制图片地址、查看详情、换一张；`contextmenu` 事件 |
| 搜索增强 | M | 自定义引擎（URL 模板含 `%s`）、`!g` / `!b` 前缀切引擎、`/` 聚焦搜索、搜索建议（需隐私开关）；`ENGINES` 从常量改为配置 |
| 全局快捷键 | S | `chrome.commands`：换一张、打开 popup、聚焦搜索；MV3 可用 |
| 天气 | M | 需定位或城市 + 第三方 API key；默认关闭并写清隐私，离线要能隐藏 |
| 专注 / 待办 | L | 番茄钟、今日待办；会改变产品定位，建议放 backlog |

### C. 设置与数据

| 功能 | 成本 | 落点与要点 |
| --- | --- | --- |
| 选项页 | M | `options_ui`；集中保留天数、画质、地区、更新时刻、组件开关、清除缓存、收藏管理。当前没有这个页面，所有常量都不可达 |
| 设置同步 | S | 小设置进 `chrome.storage.sync`；`siteIcons` 必须留在 local（sync 单条 8 KB / 总量 100 KB，100 条图标会超） |
| 缓存面板 | S | `navigator.storage.estimate()` 显示用量和图数；清空 / 只清非收藏 / 重新下载 |
| 配置导入导出 | S | JSON 下载与导入，便于换机、排障 |
| 多语言 i18n | M | `_locales/zh_CN`、`en` + `default_locale`；字符串集中到 `messages.json`，CSS 里没有文案，改造成本可控 |
| 主题 | S | 跟随系统 / 浅色 / 深色；popup 现在硬编码白底深字 |
| 自定义更新时刻 | S | 把 `nextSixAM` 改成读设置；注意 `periodInMinutes: 1440` 在夏令时/睡眠唤醒时可能漂移，可改为每次算下一次 |

### D. 工程与发布

| 事项 | 成本 | 说明 |
| --- | --- | --- |
| 权限收窄 | M | 抓图标改为可选权限：`optional_host_permissions` + 首次使用时 `chrome.permissions.request`。全量 host 权限是商店审核和用户信任的主要阻力 |
| 隐私说明 | S | 明确"会读取常访问站点 HTML 找图标、图片与记录不上传"；`site-icons.js` 用 `credentials: "include"` 抓页面，需在说明里讲清 |
| Chrome API 层测试 | M | `test/helpers/chrome.js` mock `alarms/storage/topSites/action`，覆盖 SW 流程与 popup 渲染；目前这层只能靠真机 |
| e2e | M | Playwright `launchPersistentContext` + 加载解压扩展，断言新标签页出图、站点渲染、切引擎持久化 |
| CI | S | GitHub Actions `npm ci && npm test`；加 manifest 与 package.json 版本一致性检查 |
| 图标抓取限流 | S | 每次新标签对 10 个站点并发抓 HTML，加并发上限（4）与页面关闭时 `AbortController`；负缓存已有 |
| 商店素材 | S | 截图、描述、隐私政策链接、更新日志 |

## 5. 建议路线图

**v1.2「把存量用满」— 已完成（2026-10-23）**

已落地：历史回填 7 天（历史 1080p）、缩略图、收藏、保存原图、选项页与缓存清理、可读性自适应、失败角标。

| 功能 | 落点 |
| --- | --- |
| 历史回填 | `src/bing.js` `fetchArchive`、`src/service-worker.js` `syncWallpapers` |
| 缩略图 | `src/thumbnail.js`，记录存 `thumb`，popup 优先使用 |
| 收藏 | `src/store.js` `setFavorite`，清理与淘汰跳过收藏 |
| 保存原图 | `src/popup.js`，`bing-YYYYMMDD-标题.jpg` |
| 选项页 | `src/options.*`、`src/settings.js`，含缓存统计与清理 |
| 可读性 | `src/tone.js` + `:root[data-tone="light"]` |

**v1.3「可配置」— 进行中**

已完成：自定义画质（任意宽高，服务端缩放）、日期时间可视化（到秒，可配置 12/24 制与日期格式）。

剩余：`storage.sync`、快捷键、自定义快捷方式、搜索增强、详情链接。

**v2.0「可发布」**

多图源 + i18n + 权限收窄 + 隐私说明 + e2e + 商店上架。

## 6. 不建议做 / 有坑

- **设为系统桌面壁纸**：Chrome 扩展无权改 OS 壁纸，需要 native messaging host，安装链路断裂且商店审核复杂。替代：保存到本地 + 一键复制。
- **视频 / 动态壁纸**：单张 UHD 已 3.6 MB，视频会让缓存和电量不可控。
- **天气默认开启**：定位权限 + API key + 隐私说明，收益/成本比低，只做可选。
- **遥测 / 使用统计**：需要隐私政策和合规成本，与当前"纯本地"定位冲突。
- **按图片日期清理**：v1.2 已把 `deleteExpiredImages` 改为按 `date` 计算窗口，改小保留天数会立即裁剪。

## 7. 验收指标

- 首次安装 ≤ 10 s 内出现壁纸，历史 ≥ 3 张。
- 新标签页缓存命中时首屏 < 500 ms，无黑屏闪烁。
- popup 打开到渲染完成 < 150 ms，内存 < 50 MB。
- 7 天缓存 ≤ 30 MB（UHD 档）/ ≤ 3 MB（1080p 档）。
- 断网时仍展示最近一张，并显示"N 天前"。
- `npm test` 覆盖新增的纯逻辑（回填解析、收藏淘汰、快捷方式合并、画质 URL）。
