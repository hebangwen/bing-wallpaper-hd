import test from "node:test";
import assert from "node:assert/strict";
import { pickImageSize, buildImageUrl } from "../src/resolution.js";

test("4K display selects UHD", () => {
  const size = pickImageSize(3840, 2160);
  assert.equal(size.suffix, "UHD");
});

test("2560x1440 display selects UHD as smallest covering size", () => {
  const size = pickImageSize(2560, 1440);
  assert.equal(size.suffix, "UHD");
});

test("1920x1080 display selects 1920x1080", () => {
  const size = pickImageSize(1920, 1080);
  assert.equal(size.suffix, "1920x1080");
});

test("1440x900 display selects 1920x1080", () => {
  const size = pickImageSize(1440, 900);
  assert.equal(size.suffix, "1920x1080");
});

test("1600x1200 display selects 1920x1200", () => {
  const size = pickImageSize(1600, 1200);
  assert.equal(size.suffix, "1920x1200");
});

test("oversized device falls back to largest available", () => {
  const size = pickImageSize(5120, 2880);
  assert.equal(size.suffix, "UHD");
});

test("buildImageUrl appends size suffix", () => {
  const url = buildImageUrl("/th?id=OHR.ElGolfo_ZH-CN8329995759", { suffix: "UHD" });
  assert.equal(url, "https://www.bing.com/th?id=OHR.ElGolfo_ZH-CN8329995759_UHD.jpg");
});
