import {
  MARKETS,
  QUALITIES,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from "./settings.js";
import { clearImages, getAllImages } from "./store.js";

const QUALITY_LABELS = {
  UHD: "UHD 3840×2160",
  "1920x1200": "1920×1200",
  "1920x1080": "1920×1080",
  "1366x768": "1366×768",
};

const MARKET_LABELS = {
  "zh-CN": "简体中文",
  "en-US": "English (US)",
  "ja-JP": "日本語",
  "de-DE": "Deutsch",
  "fr-FR": "Français",
};

const RETENTION_OPTIONS = [3, 7, 14, 30];

const quality = document.getElementById("quality");
const market = document.getElementById("market");
const retention = document.getElementById("retention");
const hour = document.getElementById("hour");
const message = document.getElementById("message");

let settings = normalizeSettings(null);

function fillSelect(select, entries, selected) {
  const pairs = entries.map(([value, label]) => [String(value), label]);
  if (!pairs.some(([value]) => value === String(selected))) {
    pairs.push([String(selected), String(selected)]);
  }

  select.replaceChildren(
    ...pairs.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
  select.value = String(selected);
}

function applyToControls() {
  fillSelect(
    quality,
    QUALITIES.map((value) => [value, QUALITY_LABELS[value] ?? value]),
    settings.quality,
  );
  fillSelect(
    market,
    MARKETS.map((value) => [value, MARKET_LABELS[value] ?? value]),
    settings.market,
  );
  fillSelect(
    retention,
    RETENTION_OPTIONS.map((days) => [days, `${days} 天`]),
    settings.retentionDays,
  );
  fillSelect(
    hour,
    Array.from({ length: 24 }, (_, value) => [
      value,
      `${String(value).padStart(2, "0")}:00`,
    ]),
    settings.updateHour,
  );
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index === 0 || value >= 10 ? 0 : 1)} ${units[index]}`;
}

let flashTimer;

function flash(text) {
  message.textContent = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    message.textContent = "";
  }, 2500);
}

async function refreshStats() {
  const images = await getAllImages();
  const bytes = images.reduce(
    (total, image) => total + (image.blob?.size ?? 0) + (image.thumb?.size ?? 0),
    0,
  );

  document.getElementById("count").textContent = String(images.length);
  document.getElementById("usage").textContent = formatBytes(bytes);
  document.getElementById("favorites").textContent = String(
    images.filter((image) => image.favorite).length,
  );
}

async function update(patch) {
  settings = normalizeSettings({ ...settings, ...patch });
  await saveSettings(settings);
  applyToControls();
  await chrome.runtime.sendMessage({ type: "reschedule" }).catch(() => {});
  flash("已保存");
  await refreshStats();
}

async function clear(keepFavorites) {
  if (!keepFavorites && !confirm("清除全部壁纸？收藏的图片也会删除。")) return;

  const buttons = document.querySelectorAll(".buttons button");
  for (const button of buttons) button.disabled = true;

  try {
    const deleted = await clearImages({ keepFavorites });
    flash(deleted > 0 ? `已清除 ${deleted} 张` : "没有可清除的图片");
    await refreshStats();
  } finally {
    for (const button of buttons) button.disabled = false;
  }
}

settings = await loadSettings();
applyToControls();
await refreshStats();

quality.addEventListener("change", () => update({ quality: quality.value }));
market.addEventListener("change", () => update({ market: market.value }));
retention.addEventListener("change", () => update({ retentionDays: Number(retention.value) }));
hour.addEventListener("change", () => update({ updateHour: Number(hour.value) }));

document
  .getElementById("clear-unpinned")
  .addEventListener("click", () => clear(true));
document
  .getElementById("clear-all")
  .addEventListener("click", () => clear(false));
