import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMessage,
  normalizeLanguage,
  resolveLanguage,
} from "../src/i18n.js";

test("normalizes the language setting", () => {
  assert.equal(normalizeLanguage("auto"), "auto");
  assert.equal(normalizeLanguage("en"), "en");
  assert.equal(normalizeLanguage("zh-CN"), "zh-CN");
  assert.equal(normalizeLanguage("ja-JP"), "auto");
  assert.equal(normalizeLanguage(undefined), "auto");
});

test("resolves auto from the browser language", () => {
  assert.equal(resolveLanguage("auto", "zh-CN"), "zh-CN");
  assert.equal(resolveLanguage("auto", "zh-TW"), "zh-CN");
  assert.equal(resolveLanguage("auto", "en-US"), "en");
  assert.equal(resolveLanguage("auto", "ja-JP"), "en");
  assert.equal(resolveLanguage("en", "zh-CN"), "en");
  assert.equal(resolveLanguage("zh-CN", "en-US"), "zh-CN");
});

test("fills numbered placeholders", () => {
  assert.equal(formatMessage("已清除 $1 张", [3]), "已清除 3 张");
  assert.equal(formatMessage("$1 / $2", [1, 2]), "1 / 2");
  assert.equal(formatMessage("Cleared $1 images"), "Cleared  images");
  assert.equal(formatMessage("no placeholders", ["x"]), "no placeholders");
});
