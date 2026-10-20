import test from "node:test";
import assert from "node:assert/strict";
import { pruneSiteIcons, rankSiteIcons } from "../src/site-icons.js";

test("ranks a vector icon ahead of a large raster icon", () => {
  const icons = rankSiteIcons([
    { href: "https://example.com/apple-touch-icon.png", rel: "apple-touch-icon", sizes: "180x180", type: "image/png" },
    { href: "https://example.com/icon.svg", rel: "icon", sizes: "any", type: "image/svg+xml" },
  ]);

  assert.deepEqual(
    icons.map((icon) => icon.href),
    ["https://example.com/icon.svg", "https://example.com/apple-touch-icon.png"],
  );
});

test("ranks a standard vector icon ahead of a mask icon", () => {
  const icons = rankSiteIcons([
    { href: "https://example.com/mask.svg", rel: "mask-icon", sizes: "", type: "image/svg+xml" },
    { href: "https://example.com/favicon.svg", rel: "icon", sizes: "", type: "image/svg+xml" },
  ]);

  assert.deepEqual(
    icons.map((icon) => icon.href),
    ["https://example.com/favicon.svg", "https://example.com/mask.svg"],
  );
});

test("ranks larger raster icons first", () => {
  const icons = rankSiteIcons([
    { href: "https://example.com/16.png", rel: "icon", sizes: "16x16", type: "image/png" },
    { href: "https://example.com/192.png", rel: "icon", sizes: "192x192", type: "image/png" },
    { href: "https://example.com/32.png", rel: "icon", sizes: "32x32", type: "image/png" },
  ]);

  assert.deepEqual(
    icons.map((icon) => icon.href),
    ["https://example.com/192.png", "https://example.com/32.png", "https://example.com/16.png"],
  );
});

test("assumes apple-touch icons are high resolution when sizes are absent", () => {
  const icons = rankSiteIcons([
    { href: "https://example.com/favicon.ico", rel: "shortcut icon", sizes: "", type: "image/x-icon" },
    { href: "https://example.com/touch.png", rel: "apple-touch-icon", sizes: "", type: "image/png" },
  ]);

  assert.deepEqual(
    icons.map((icon) => icon.href),
    ["https://example.com/touch.png", "https://example.com/favicon.ico"],
  );
});

test("returns an empty ranking without candidates", () => {
  assert.deepEqual(rankSiteIcons([]), []);
});

test("drops expired and incomplete site icon entries", () => {
  const now = Date.now();
  const pruned = pruneSiteIcons(
    {
      fresh: { checkedAt: now - 1_000 },
      expired: { checkedAt: now - 8 * 24 * 60 * 60 * 1000 },
      incomplete: { url: "https://example.com/icon.png" },
    },
    { now, ttlMs: 7 * 24 * 60 * 60 * 1000, limit: 10 },
  );

  assert.deepEqual(Object.keys(pruned), ["fresh"]);
});

test("keeps the newest site icons when the cache exceeds the limit", () => {
  const now = Date.now();
  const pruned = pruneSiteIcons(
    {
      oldest: { checkedAt: now - 3_000 },
      middle: { checkedAt: now - 2_000 },
      newest: { checkedAt: now - 1_000 },
    },
    { now, ttlMs: 10_000, limit: 2 },
  );

  assert.deepEqual(Object.keys(pruned), ["newest", "middle"]);
});
