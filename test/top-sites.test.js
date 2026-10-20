import test from "node:test";
import assert from "node:assert/strict";
import { TOP_SITE_LIMIT, topSitesFrom } from "../src/top-sites.js";

test("keeps API order and caps at the default limit", () => {
  const raw = Array.from({ length: 12 }, (_, index) => ({
    url: `https://site${index}.com/`,
    title: `Site ${index}`,
  }));

  const sites = topSitesFrom(raw);

  assert.equal(sites.length, TOP_SITE_LIMIT);
  assert.deepEqual(
    sites.map((site) => site.name),
    raw.slice(0, TOP_SITE_LIMIT).map((site) => site.title),
  );
});

test("filters out non-http pages", () => {
  const sites = topSitesFrom([
    { url: "chrome://settings/", title: "Settings" },
    { url: "file:///Users/me/index.html", title: "Local" },
    { url: "javascript:alert(1)", title: "Script" },
    { url: "https://example.com/", title: "Example" },
  ]);

  assert.deepEqual(sites, [{ url: "https://example.com/", host: "example.com", name: "Example" }]);
});

test("dedupes by hostname while ignoring www", () => {
  const sites = topSitesFrom([
    { url: "https://www.github.com/explore", title: "GitHub" },
    { url: "https://github.com/hebangwen", title: "GitHub Profile" },
    { url: "https://gist.github.com/", title: "Gist" },
  ]);

  assert.deepEqual(
    sites.map((site) => site.host),
    ["github.com", "gist.github.com"],
  );
});

test("falls back to hostname when the title is blank", () => {
  const sites = topSitesFrom([{ url: "https://www.example.com/path", title: "   " }]);

  assert.equal(sites[0].name, "example.com");
});

test("skips malformed urls", () => {
  const sites = topSitesFrom([
    { url: "not a url", title: "Broken" },
    { url: "https://example.com/", title: "Example" },
  ]);

  assert.equal(sites.length, 1);
  assert.equal(sites[0].host, "example.com");
});

test("respects a custom limit", () => {
  const raw = Array.from({ length: 5 }, (_, index) => ({
    url: `https://site${index}.com/`,
    title: `Site ${index}`,
  }));

  assert.equal(topSitesFrom(raw, 2).length, 2);
});

test("returns nothing when the limit is zero", () => {
  const sites = topSitesFrom([{ url: "https://example.com/", title: "Example" }], 0);

  assert.deepEqual(sites, []);
});
