import { getAllImages } from "./store.js";

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

async function showLatest() {
  const images = (await getAllImages()).sort((a, b) => b.fetchedAt - a.fetchedAt);
  const latest = images[0];
  if (!latest) return false;
  document.getElementById("wallpaper").src = URL.createObjectURL(latest.blob);
  document.getElementById("caption").textContent = `${latest.title} · ${latest.copyright}`;
  return true;
}

if (!(await showLatest())) {
  const response = await chrome.runtime.sendMessage({ type: "fetch-now" });
  if (response?.ok) {
    await showLatest();
  } else {
    document.getElementById("caption").textContent = "壁纸获取失败，请稍后重试";
  }
}
