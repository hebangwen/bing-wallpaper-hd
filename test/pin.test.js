import test from "node:test";
import assert from "node:assert/strict";
import { captionFor, pickDisplayImage } from "../src/pin.js";

const pinnedImage = { urlbase: "/th?id=Pinned", title: "Pinned", copyright: "" };
const latest = { urlbase: "/th?id=Latest", title: "Latest", copyright: "" };

test("prefers the pinned image when it still exists", () => {
  assert.deepEqual(
    pickDisplayImage({ pinnedUrlbase: "/th?id=Pinned", pinnedImage, latest }),
    { image: pinnedImage, pinned: true },
  );
});

test("falls back to the latest image when the pin is gone", () => {
  assert.deepEqual(
    pickDisplayImage({ pinnedUrlbase: "/th?id=Pinned", pinnedImage: null, latest }),
    { image: latest, pinned: false },
  );
  assert.deepEqual(
    pickDisplayImage({ pinnedUrlbase: null, pinnedImage: null, latest }),
    { image: latest, pinned: false },
  );
});

test("returns null when nothing is cached", () => {
  assert.deepEqual(
    pickDisplayImage({ pinnedUrlbase: null, pinnedImage: null, latest: null }),
    { image: null, pinned: false },
  );
});

test("marks the caption when a wallpaper is pinned", () => {
  assert.equal(captionFor(pinnedImage, true), "已固定 · Pinned");
  assert.equal(captionFor(pinnedImage, false), "Pinned");
  assert.equal(
    captionFor({ title: "A", copyright: "B" }, true),
    "已固定 · A · B",
  );
  assert.equal(captionFor({ title: "", copyright: "" }, true), "已固定");
  assert.equal(captionFor({ title: "", copyright: "" }, false), "");
});
