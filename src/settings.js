export const QUALITIES = ["UHD", "1920x1200", "1920x1080", "1366x768"];
export const HISTORY_QUALITY = "1920x1080";
export const MARKETS = ["zh-CN", "en-US", "ja-JP", "de-DE", "fr-FR"];
export const MAX_BACKFILL_DAYS = 8;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_SETTINGS = {
  quality: "UHD",
  retentionDays: 7,
  updateHour: 6,
  market: "zh-CN",
};

const QUALITY_RANK = new Map(QUALITIES.map((quality, index) => [quality, index]));

function clampInt(value, min, max, fallback) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeSettings(raw) {
  const settings = raw ?? {};

  return {
    quality: QUALITIES.includes(settings.quality) ? settings.quality : DEFAULT_SETTINGS.quality,
    retentionDays: clampInt(settings.retentionDays, 1, 30, DEFAULT_SETTINGS.retentionDays),
    updateHour: clampInt(settings.updateHour, 0, 23, DEFAULT_SETTINGS.updateHour),
    market: MARKETS.includes(settings.market) ? settings.market : DEFAULT_SETTINGS.market,
  };
}

// 历史图只用于历史浏览，统一压到 1080p；用户选择更低画质时跟随用户。
export function qualityFor(quality, isToday) {
  const normalized = QUALITIES.includes(quality) ? quality : DEFAULT_SETTINGS.quality;
  if (isToday) return normalized;

  const rank = QUALITY_RANK.get(normalized);
  return rank < QUALITY_RANK.get(HISTORY_QUALITY) ? HISTORY_QUALITY : normalized;
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
