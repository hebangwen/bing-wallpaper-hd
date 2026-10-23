import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS,
  DEFAULT_SETTINGS,
  QUALITIES,
  backfillCount,
  nextRunAt,
  normalizeSettings,
  parseQuality,
  qualityFor,
  retentionMsFor,
} from "../src/settings.js";

test("falls back to defaults for an empty or missing object", () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
});

test("keeps valid values and clamps numeric ranges", () => {
  const settings = normalizeSettings({
    quality: "1920x1080",
    retentionDays: 14,
    updateHour: 21,
    market: "en-US",
  });

  assert.equal(settings.quality, "1920x1080");
  assert.equal(settings.retentionDays, 14);
  assert.equal(settings.updateHour, 21);
  assert.equal(settings.market, "en-US");
  assert.equal(settings.showClock, true);

  assert.equal(normalizeSettings({ retentionDays: 0 }).retentionDays, 1);
  assert.equal(normalizeSettings({ retentionDays: 99 }).retentionDays, 30);
  assert.equal(normalizeSettings({ retentionDays: "7" }).retentionDays, 7);
  assert.equal(normalizeSettings({ updateHour: -1 }).updateHour, 0);
  assert.equal(normalizeSettings({ updateHour: 24 }).updateHour, 23);
});

test("rejects unknown quality and market values", () => {
  assert.equal(normalizeSettings({ quality: "8k" }).quality, DEFAULT_SETTINGS.quality);
  assert.equal(normalizeSettings({ market: "xx-XX" }).market, DEFAULT_SETTINGS.market);
});

test("accepts a custom resolution inside the supported range", () => {
  assert.equal(parseQuality("2560x1440"), "2560x1440");
  assert.equal(parseQuality("3840x2160"), "3840x2160");
  assert.equal(parseQuality("1024x768"), "1024x768");
  assert.equal(normalizeSettings({ quality: "2560x1440" }).quality, "2560x1440");
  assert.equal(parseQuality("1920x1080"), "1920x1080");
});

test("rejects custom resolutions outside the supported range", () => {
  assert.equal(parseQuality("200x200"), null);
  assert.equal(parseQuality("9000x5000"), null);
  assert.equal(parseQuality("abc"), null);
  assert.equal(parseQuality("2560X1440"), null);
  assert.equal(parseQuality("2560x1440px"), null);
  assert.equal(normalizeSettings({ quality: "9000x5000" }).quality, "UHD");
});

test("uses UHD for today and caps history at 1080p", () => {
  assert.equal(qualityFor("UHD", true), "UHD");
  assert.equal(qualityFor("UHD", false), "1920x1080");
  assert.equal(qualityFor("1920x1200", false), "1920x1080");
  assert.equal(qualityFor("1920x1080", false), "1920x1080");
  assert.equal(qualityFor("1366x768", false), "1366x768");
  assert.equal(qualityFor("2560x1440", false), "1920x1080");
  assert.equal(qualityFor("2560x1440", true), "2560x1440");
  assert.equal(qualityFor("1024x768", false), "1024x768");
  // 非法画质先归一到默认 UHD，再按历史规则降到 1080p。
  assert.equal(qualityFor("bogus", false), "1920x1080");
  assert.equal(qualityFor("bogus", true), QUALITIES[0]);
});

test("normalizes clock settings", () => {
  assert.equal(DEFAULT_SETTINGS.showClock, true);
  assert.equal(DEFAULT_SETTINGS.showSeconds, true);
  assert.equal(normalizeSettings({ showClock: false }).showClock, false);
  assert.equal(normalizeSettings({ showSeconds: "no" }).showSeconds, true);
  assert.equal(normalizeSettings({ hour24: false }).hour24, false);
  assert.equal(normalizeSettings({ dateStyle: "numeric" }).dateStyle, "numeric");
  assert.equal(normalizeSettings({ dateStyle: "iso" }).dateStyle, "long");
});

test("normalizes effects and the wallpaper source", () => {
  assert.equal(normalizeSettings({ source: "wikimedia-en" }).source, "wikimedia-en");
  assert.equal(normalizeSettings({ source: "nope" }).source, "bing");
  assert.equal(normalizeSettings({ wallpaperBlur: 99 }).wallpaperBlur, 40);
  assert.equal(normalizeSettings({ wallpaperBlur: -5 }).wallpaperBlur, 0);
  assert.equal(normalizeSettings({ wallpaperDim: 120 }).wallpaperDim, 70);
  assert.equal(normalizeSettings({ glassEffect: false }).glassEffect, false);
  assert.equal(normalizeSettings({ glassEffect: "on" }).glassEffect, true);
});

test("caps the backfill window at eight days", () => {
  assert.equal(backfillCount(1), 1);
  assert.equal(backfillCount(7), 7);
  assert.equal(backfillCount(30), 8);
  assert.equal(backfillCount("abc"), DEFAULT_SETTINGS.retentionDays);
});

test("converts retention days to milliseconds", () => {
  assert.equal(retentionMsFor(3), 3 * DAY_MS);
  assert.equal(retentionMsFor(0), DAY_MS);
});

test("schedules the next run at the configured local hour", () => {
  const morning = new Date(2026, 9, 21, 5, 30, 0).getTime();
  assert.equal(nextRunAt(6, morning), new Date(2026, 9, 21, 6, 0, 0).getTime());

  const exactly = new Date(2026, 9, 21, 6, 0, 0).getTime();
  assert.equal(nextRunAt(6, exactly), new Date(2026, 9, 22, 6, 0, 0).getTime());

  const evening = new Date(2026, 9, 21, 23, 0, 0).getTime();
  assert.equal(nextRunAt(6, evening), new Date(2026, 9, 22, 6, 0, 0).getTime());
});
