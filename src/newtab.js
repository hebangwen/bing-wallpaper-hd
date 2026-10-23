import { getLatestImage } from "./store.js";
import { resolveSiteIcons } from "./site-icons.js";
import { resolveTone } from "./tone.js";
import { topSitesFrom } from "./top-sites.js";

const ENGINES = {
  bing: { label: "Bing", action: "https://www.bing.com/search", param: "q" },
  google: { label: "Google", action: "https://www.google.com/search", param: "q" },
  baidu: { label: "百度", action: "https://www.baidu.com/s", param: "wd" },
};

function applyEngine(key) {
  const engine = ENGINES[key] ?? ENGINES.bing;
  document.getElementById("search").action = engine.action;
  document.querySelector("#search input").name = engine.param;
  const selected = key in ENGINES ? key : "bing";
  document.getElementById("engine-label").textContent = ENGINES[selected].label;
  for (const item of document.querySelectorAll("#engine-menu li")) {
    item.setAttribute("aria-selected", String(item.dataset.engine === selected));
  }
}

const menu = document.getElementById("engine-menu");
const toggle = document.getElementById("engine-toggle");
for (const [key, engine] of Object.entries(ENGINES)) {
  const item = document.createElement("li");
  item.textContent = engine.label;
  item.dataset.engine = key;
  item.role = "option";
  item.addEventListener("click", () => {
    applyEngine(key);
    chrome.storage.local.set({ searchEngine: key });
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    document.querySelector("#search input").focus();
  });
  menu.append(item);
}

toggle.addEventListener("click", () => {
  menu.hidden = !menu.hidden;
  toggle.setAttribute("aria-expanded", String(!menu.hidden));
});

document.addEventListener("click", (event) => {
  if (!document.getElementById("engine").contains(event.target)) {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }
});

applyEngine((await chrome.storage.local.get("searchEngine")).searchEngine);

async function showTopSites() {
  const nav = document.getElementById("top-sites");
  let rawSites;
  try {
    rawSites = await chrome.topSites.get();
  } catch {
    return;
  }

  const sites = topSitesFrom(rawSites);
  if (sites.length === 0) return;

  const icons = new Map();
  nav.replaceChildren(
    ...sites.map((site) => {
      const link = document.createElement("a");
      link.href = site.url;
      link.title = site.name;

      const icon = document.createElement("img");
      const favicon = new URL(chrome.runtime.getURL("/_favicon/"));
      favicon.searchParams.set("pageUrl", site.url);
      favicon.searchParams.set("size", "32");
      icon.src = favicon.toString();
      icon.alt = "";
      icon.width = 20;
      icon.height = 20;
      icons.set(site.host, icon);

      const name = document.createElement("span");
      name.textContent = site.name;

      link.append(icon, name);
      return link;
    }),
  );
  nav.hidden = false;

  resolveSiteIcons(sites, (site, iconUrl) => {
    icons.get(site.host).src = iconUrl;
  }).catch(() => {});
}

showTopSites();

let wallpaperUrl;

function setWallpaper(blob) {
  if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
  wallpaperUrl = URL.createObjectURL(blob);
  document.getElementById("wallpaper").src = wallpaperUrl;
}

addEventListener("pagehide", () => {
  if (!wallpaperUrl) return;
  URL.revokeObjectURL(wallpaperUrl);
  wallpaperUrl = undefined;
});

async function showLatest() {
  const latest = await getLatestImage();
  if (!latest) return false;
  setWallpaper(latest.blob);
  document.getElementById("caption").textContent = [latest.title, latest.copyright]
    .filter(Boolean)
    .join(" · ");
  document.documentElement.dataset.tone = await resolveTone({
    drk: latest.drk,
    blob: latest.thumb ?? latest.blob,
  });
  return true;
}

try {
  if (!(await showLatest())) {
    let fetched = false;
    try {
      fetched = Boolean((await chrome.runtime.sendMessage({ type: "fetch-now" }))?.ok);
    } catch {}

    if (!fetched || !(await showLatest())) {
      document.getElementById("caption").textContent = "壁纸获取失败，请稍后重试";
    }
  }
} catch {
  document.getElementById("caption").textContent = "壁纸读取失败，请刷新重试";
}
