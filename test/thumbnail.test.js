import test from "node:test";
import assert from "node:assert/strict";
import { THUMB_MAX_WIDTH, thumbnailSize } from "../src/thumbnail.js";

test("scales a UHD frame down to the thumbnail width", () => {
  assert.deepEqual(thumbnailSize(3840, 2160), { width: 640, height: 360 });
  assert.equal(THUMB_MAX_WIDTH, 640);
});

test("keeps small images untouched", () => {
  assert.deepEqual(thumbnailSize(400, 300), { width: 400, height: 300 });
  assert.deepEqual(thumbnailSize(640, 360), { width: 640, height: 360 });
});

test("honours a custom max width", () => {
  assert.deepEqual(thumbnailSize(1920, 1080, 480), { width: 480, height: 270 });
});

test("returns an empty size for invalid input", () => {
  assert.deepEqual(thumbnailSize(0, 0), { width: 0, height: 0 });
  assert.deepEqual(thumbnailSize(-1, 100), { width: 0, height: 0 });
  assert.deepEqual(thumbnailSize(100, 100, 0), { width: 0, height: 0 });
});
