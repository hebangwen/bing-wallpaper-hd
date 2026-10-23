import { applyI18n, initI18n, t } from "./i18n.js";
import {
  DATE_STYLES,
  LANGUAGES,
  PRESET_QUALITIES,
  SOURCE_IDS,
  loadSettings,
  normalizeSettings,
  parseQuality,
  saveSettings,
} from "./settings.js";
import { SOURCE_LABEL_KEYS } from "./sources/index.js";
import {
  clearImages,
  deleteImagesExceptSource,
  getAllImages,
} from "./store.js";

const QUALITY_LABELS = {
  UHD: "UHD 3840×2160",
  "1920x1200": "1920×1200",
  "1920x1080": "1920×1080",
  "1366x768": "1366×768",
  "1280x720": "1280×720",
};

const LANGUAGE_LABEL_KEYS = {
  auto: "languageAuto",
  "zh-CN": "languageZh",
  en: "languageEn",
};

const DATE_STYLE_KEYS = {
  long: "dateStyleLong",
  numeric: "dateStyleNumeric",
  hidden: "dateStyleHidden",
};

const RETENTION_OPTIONS = [3, 7, 14, 30];

const source = document.getElementById("source");
const quality = document.getElementById("quality");
const customRow = document.getElementById("custom-quality");
const customWidth = document.getElementById("custom-width");
const customHeight = document.getElementById("custom-height");
const language = document.getElementById("language");
const retention = document.getElementById("retention");
const hour = document.getElementById("hour");
const showClock = document.getElementById("show-clock");
const showSeconds = document.getElementById("show-seconds");
const hour24 = document.getElementById("hour24");
const dateStyle = document.getElementById("date-style");
const blur = document.getElementById("blur");
const dim = document.getElementById("dim");
const glass = document.getElementById("glass");
const message = document.getElementById("message");

let settings = normalizeSettings(null);
let previewUrl;

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

function applyPreview(current) {
  const preview = document.getElementById("preview");
  preview.style.setProperty("--preview-blur", `${current.wallpaperBlur}px`);
  preview.style.setProperty("--preview-scale", String(1 + current.wallpaperBlur / 150));
  preview.style.setProperty("--preview-dim", String(current.wallpaperDim / 100));
  preview.dataset.glass = current.glassEffect ? "on" : "off";

  document.getElementById("blur-value").textContent = `${current.wallpaperBlur} px`;
  document.getElementById("dim-value").textContent = `${current.wallpaperDim}%`;
}

function applyToControls() {
  fillSelect(
    source,
    SOURCE_IDS.map((id) => [id, t(SOURCE_LABEL_KEYS[id] ?? id)]),
    settings.source,
  );

  const preset = PRESET_QUALITIES.includes(settings.quality) ? settings.quality : "custom";
  fillSelect(
    quality,
    [
      ...PRESET_QUALITIES.map((value) => [value, QUALITY_LABELS[value] ?? value]),
      ["custom", t("customOption")],
    ],
    preset,
  );

  customRow.hidden = preset !== "custom";
  const size = parseQuality(settings.quality);
  const [width, height] = size === "UHD" || !size ? [3840, 2160] : size.split("x").map(Number);
  customWidth.value = String(width);
  customHeight.value = String(height);

  fillSelect(
    language,
    LANGUAGES.map((value) => [value, t(LANGUAGE_LABEL_KEYS[value])]),
    settings.language,
  );
  fillSelect(
    retention,
    RETENTION_OPTIONS.map((days) => [days, t("retentionOption", [days])]),
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
  fillSelect(
    dateStyle,
    DATE_STYLES.map((value) => [value, t(DATE_STYLE_KEYS[value])]),
    settings.dateStyle,
  );

  showClock.checked = settings.showClock;
  showSeconds.checked = settings.showSeconds;
  hour24.checked = settings.hour24;

  for (const control of [showSeconds, hour24, dateStyle]) {
    control.disabled = !settings.showClock;
  }

  blur.value = String(settings.wallpaperBlur);
  dim.value = String(settings.wallpaperDim);
  glass.checked = settings.glassEffect;
  applyPreview(settings);
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

async function loadPreviewImage() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
  }
  document.getElementById("preview-image").style.backgroundImage = "";

  const images = await getAllImages();
  const latest = [...images].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  const blob = latest?.thumb ?? latest?.blob;
  if (!blob) return;

  previewUrl = URL.createObjectURL(blob);
  document.getElementById("preview-image").style.backgroundImage = `url("${previewUrl}")`;
}

let saveChain = Promise.resolve();

// 连续修改（例如两个滑块）串行落盘，避免旧快照覆盖新值。
function update(patch) {
  settings = normalizeSettings({ ...settings, ...patch });
  const snapshot = settings;

  saveChain = saveChain
    .then(async () => {
      await saveSettings(snapshot);
      await initI18n(snapshot.language);
      applyI18n();
      applyToControls();
      // 通知 Service Worker 重排闹钟；统计刷新放到后台，避免阻塞切换图源后的清理。
      chrome.runtime.sendMessage({ type: "reschedule" }).catch(() => {});
      flash(t("saved"));
      refreshStats().catch(() => {});
    })
    .catch((error) => {
      flash(String(error));
    });

  return saveChain;
}

async function clear(keepFavorites) {
  if (!keepFavorites && !confirm(t("confirmClearAll"))) return;

  const buttons = document.querySelectorAll(".buttons button");
  for (const button of buttons) button.disabled = true;

  try {
    const deleted = await clearImages({ keepFavorites });
    flash(deleted > 0 ? t("clearedCount", [deleted]) : t("nothingToClear"));
    await refreshStats();
  } finally {
    for (const button of buttons) button.disabled = false;
  }
}

settings = await loadSettings();
await initI18n(settings.language);
applyI18n();
applyToControls();
await Promise.all([refreshStats(), loadPreviewImage()]);

source.addEventListener("change", async () => {
  const next = source.value;
  await update({ source: next });
  await deleteImagesExceptSource(next);
  await refreshStats();

  flash(t("updatingSource"));
  try {
    await chrome.runtime.sendMessage({ type: "fetch-now" });
    flash(t("saved"));
  } catch {}
  await refreshStats();
  await loadPreviewImage();
});

quality.addEventListener("change", () => {
  if (quality.value === "custom") {
    customRow.hidden = false;
    customWidth.focus();
    customWidth.select();
    return;
  }

  customRow.hidden = true;
  update({ quality: quality.value });
});

document.getElementById("apply-quality").addEventListener("click", () => {
  const size = parseQuality(`${Number(customWidth.value)}x${Number(customHeight.value)}`);
  if (!size) {
    flash(t("invalidSize"));
    return;
  }

  update({ quality: size });
});

language.addEventListener("change", () => update({ language: language.value }));
retention.addEventListener("change", () => update({ retentionDays: Number(retention.value) }));
hour.addEventListener("change", () => update({ updateHour: Number(hour.value) }));
showClock.addEventListener("change", () => update({ showClock: showClock.checked }));
showSeconds.addEventListener("change", () => update({ showSeconds: showSeconds.checked }));
hour24.addEventListener("change", () => update({ hour24: hour24.checked }));
dateStyle.addEventListener("change", () => update({ dateStyle: dateStyle.value }));

blur.addEventListener("input", () => {
  settings = normalizeSettings({ ...settings, wallpaperBlur: Number(blur.value) });
  applyPreview(settings);
});
blur.addEventListener("change", () => update({ wallpaperBlur: Number(blur.value) }));

dim.addEventListener("input", () => {
  settings = normalizeSettings({ ...settings, wallpaperDim: Number(dim.value) });
  applyPreview(settings);
});
dim.addEventListener("change", () => update({ wallpaperDim: Number(dim.value) }));

glass.addEventListener("change", () => update({ glassEffect: glass.checked }));

document
  .getElementById("clear-unpinned")
  .addEventListener("click", () => clear(true));
document
  .getElementById("clear-all")
  .addEventListener("click", () => clear(false));

addEventListener("pagehide", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
});
