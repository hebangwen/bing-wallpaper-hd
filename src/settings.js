export const PRESET_QUALITIES = ["UHD", "1920x1200", "1920x1080", "1366x768", "1280x720"];
export const QUALITIES = PRESET_QUALITIES;
export const HISTORY_QUALITY = "1920x1080";
export const LANGUAGES = ["auto", "zh-CN", "en"];
export const DATE_STYLES = ["long", "numeric", "hidden"];
export const SOURCE_IDS = ["bing", "wikimedia-en", "wikimedia-zh", "wallhaven", "picsum"];
export const MAX_BACKFILL_DAYS = 8;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const MAX_WALLPAPER_BLUR = 40;
export const MAX_WALLPAPER_DIM = 70;

export const MIN_CUSTOM_WIDTH = 320;
export const MAX_CUSTOM_WIDTH = 7680;
export const MIN_CUSTOM_HEIGHT = 240;
export const MAX_CUSTOM_HEIGHT = 4320;

export const DEFAULT_SETTINGS = {
  quality: "UHD",
  retentionDays: 7,
  updateHour: 6,
  language: "auto",
  showClock: true,
  showSeconds: true,
  hour24: true,
  dateStyle: "long",
  source: "bing",
  wallpaperBlur: 0,
  wallpaperDim: 0,
  glassEffect: true,
};

const CUSTOM_QUALITY = /^(\d{3,4})x(\d{3,4})$/;

function clampInt(value, min, max, fallback) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function asBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

// 旧版本只有 market（Bing mkt），迁移到界面语言。
function normalizeLanguageSetting(value, legacyMarket) {
  if (LANGUAGES.includes(value)) return value;
  if (legacyMarket === "zh-CN") return "zh-CN";
  if (legacyMarket === "en-US") return "en";
  return "auto";
}

export function marketFor(language, uiLanguage = "zh-CN") {
  if (language === "zh-CN") return "zh-CN";
  if (language === "en") return "en-US";
  return String(uiLanguage).toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

// 接受预设档位或 320×240 ~ 7680×4320 内的任意宽高，非法值返回 null。
export function parseQuality(value) {
  const text = String(value ?? "");
  if (PRESET_QUALITIES.includes(text)) return text;

  const match = CUSTOM_QUALITY.exec(text);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < MIN_CUSTOM_WIDTH || width > MAX_CUSTOM_WIDTH) return null;
  if (height < MIN_CUSTOM_HEIGHT || height > MAX_CUSTOM_HEIGHT) return null;

  return `${width}x${height}`;
}

export function qualityPixels(quality) {
  const parsed = parseQuality(quality) ?? DEFAULT_SETTINGS.quality;
  if (parsed === "UHD") return 3840 * 2160;

  const [width, height] = parsed.split("x").map(Number);
  return width * height;
}

export function normalizeSettings(raw) {
  const settings = raw ?? {};

  return {
    quality: parseQuality(settings.quality) ?? DEFAULT_SETTINGS.quality,
    retentionDays: clampInt(settings.retentionDays, 1, 30, DEFAULT_SETTINGS.retentionDays),
    updateHour: clampInt(settings.updateHour, 0, 23, DEFAULT_SETTINGS.updateHour),
    language: normalizeLanguageSetting(settings.language, settings.market),
    showClock: asBoolean(settings.showClock, DEFAULT_SETTINGS.showClock),
    showSeconds: asBoolean(settings.showSeconds, DEFAULT_SETTINGS.showSeconds),
    hour24: asBoolean(settings.hour24, DEFAULT_SETTINGS.hour24),
    dateStyle: DATE_STYLES.includes(settings.dateStyle)
      ? settings.dateStyle
      : DEFAULT_SETTINGS.dateStyle,
    source: SOURCE_IDS.includes(settings.source) ? settings.source : DEFAULT_SETTINGS.source,
    wallpaperBlur: clampInt(settings.wallpaperBlur, 0, MAX_WALLPAPER_BLUR, DEFAULT_SETTINGS.wallpaperBlur),
    wallpaperDim: clampInt(settings.wallpaperDim, 0, MAX_WALLPAPER_DIM, DEFAULT_SETTINGS.wallpaperDim),
    glassEffect: asBoolean(settings.glassEffect, DEFAULT_SETTINGS.glassEffect),
  };
}

// 历史图只用于历史浏览，统一压到 1080p；用户选择更低画质时跟随用户。
export function qualityFor(quality, isToday) {
  const parsed = parseQuality(quality) ?? DEFAULT_SETTINGS.quality;
  if (isToday) return parsed;

  return qualityPixels(parsed) > qualityPixels(HISTORY_QUALITY) ? HISTORY_QUALITY : parsed;
}

export function backfillCount(retentionDays) {
  return clampInt(retentionDays, 1, MAX_BACKFILL_DAYS, DEFAULT_SETTINGS.retentionDays);
}

export function retentionMsFor(retentionDays) {
  return clampInt(retentionDays, 1, 30, DEFAULT_SETTINGS.retentionDays) * DAY_MS;
}

export function nextRunAt(updateHour, now = Date.now()) {
  const date = new Date(now);
  date.setHours(clampInt(updateHour, 0, 23, DEFAULT_SETTINGS.updateHour), 0, 0, 0);
  if (date.getTime() <= now) {
    date.setDate(date.getDate() + 1);
  }
  return date.getTime();
}

export async function loadSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return normalizeSettings(settings);
}

export function saveSettings(settings) {
  return chrome.storage.local.set({ settings: normalizeSettings(settings) });
}
