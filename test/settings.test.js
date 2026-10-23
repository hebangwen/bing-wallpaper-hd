import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS,
  DEFAULT_SETTINGS,
  QUALITIES,
  backfillCount,
  nextRunAt,
  normalizeSettings,
  qualityFor,
  retentionMsFor,
} from "../src/settings.js";

test("falls back to defaults for an empty or missing object", () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
});

test("keeps valid values and clamps numeric ranges", () => {
  assert.deepEqual(
    normalizeSettings({ quality: "1920x1080", retentionDays: 14, updateHour: 21, market: "en-US" }),
    { quality: "1920x1080", retentionDays: 14, updateHour: 21, market: "en-US" },
  );

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

test("uses UHD for today and caps history at 1080p", () => {
  assert.equal(qualityFor("UHD", true), "UHD");
  assert.equal(qualityFor("UHD", false), "1920x1080");
  assert.equal(qualityFor("1920x1200", false), "1920x1080");
  assert.equal(qualityFor("1920x1080", false), "1920x1080");
  assert.equal(qualityFor("1366x768", false), "1366x768");
  // 非法画质先归一到默认 UHD，再按历史规则降到 1080p。
  assert.equal(qualityFor("bogus", false), "1920x1080");
  assert.equal(qualityFor("bogus", true), QUALITIES[0]);
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
