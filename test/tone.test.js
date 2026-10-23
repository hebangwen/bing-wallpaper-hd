import test from "node:test";
import assert from "node:assert/strict";
import {
  LIGHT_IMAGE_LUMA,
  averageLuma,
  resolveTone,
  toneFromDrk,
  toneFromLuma,
} from "../src/tone.js";

test("maps the Bing drk flag to a tone", () => {
  assert.equal(toneFromDrk(1), "dark");
  assert.equal(toneFromDrk("1"), "dark");
  assert.equal(toneFromDrk(true), "dark");
  assert.equal(toneFromDrk(0), "light");
  assert.equal(toneFromDrk("0"), "light");
  assert.equal(toneFromDrk(false), "light");
  assert.equal(toneFromDrk(null), null);
  assert.equal(toneFromDrk(undefined), null);
});

test("averages RGBA pixels with luma weights", () => {
  const white = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]);
  const black = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]);
  const red = new Uint8ClampedArray([255, 0, 0, 255]);

  assert.ok(Math.abs(averageLuma(white) - 255) < 0.01);
  assert.equal(averageLuma(black), 0);
  assert.ok(Math.abs(averageLuma(red) - 54.213) < 0.01);
  assert.equal(averageLuma(new Uint8ClampedArray(0)), 0);
});

test("classifies bright images as light tone", () => {
  assert.equal(toneFromLuma(200), "light");
  assert.equal(toneFromLuma(LIGHT_IMAGE_LUMA), "light");
  assert.equal(toneFromLuma(LIGHT_IMAGE_LUMA - 1), "dark");
});

test("prefers the drk flag over sampling", async () => {
  assert.equal(await resolveTone({ drk: 1, blob: null }), "dark");
  assert.equal(await resolveTone({ drk: 0, blob: null }), "light");
  // 没有 drk 且环境不支持解码时，回退到深色文字方案。
  assert.equal(await resolveTone({ drk: null, blob: null }), "dark");
});
