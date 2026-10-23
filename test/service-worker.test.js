import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

const ARCHIVE = Array.from({ length: 7 }, (_, index) => ({
  urlbase: `/th?id=OHR.Day${index + 1}`,
  title: `Day ${index + 1}`,
  copyright: `Photo ${index + 1}`,
  startdate: `2026102${1 + index}`,
  copyrightlink: `https://www.bing.com/search?q=Day${index + 1}`,
  drk: index % 2,
}));

const storageData = {};
const handlers = {};
const imageRequests = [];
let badge = "";
let createCalls = 0;

globalThis.chrome = {
  alarms: {
    clear: async () => true,
    create: () => {
      createCalls += 1;
    },
    get: async () => undefined,
    onAlarm: { addListener: (fn) => (handlers.alarm = fn) },
  },
  storage: {
    local: {
      get: async (key) => {
        if (key == null) return { ...storageData };
        const keys = Array.isArray(key) ? key : [key];
        return Object.fromEntries(keys.map((name) => [name, storageData[name]]));
      },
      set: async (patch) => {
        Object.assign(storageData, patch);
      },
    },
    onChanged: { addListener: (fn) => (handlers.storage = fn) },
  },
  runtime: {
    onInstalled: { addListener: (fn) => (handlers.installed = fn) },
    onStartup: { addListener: (fn) => (handlers.startup = fn) },
    onMessage: { addListener: (fn) => (handlers.message = fn) },
  },
  i18n: {
    getMessage: (key) => key,
    getUILanguage: () => "zh-CN",
  },
  action: {
    setBadgeText: ({ text }) => {
      badge = text;
    },
    setBadgeBackgroundColor: () => {},
  },
};

globalThis.fetch = async (url) => {
  const href = String(url);
  if (href.includes("HPImageArchive")) {
    return Response.json({ images: ARCHIVE });
  }
  imageRequests.push(href);
  return new Response(new Blob([href]), { status: 200 });
};

const { clearImages, getAllImages, getImage, putImage } = await import("../src/store.js");
await import("../src/service-worker.js");

function fetchNow() {
  return new Promise((resolve) => {
    const handled = handlers.message({ type: "fetch-now" }, {}, resolve);
    assert.equal(handled, true);
  });
}

test("backfills the archive window with 1080p history", async () => {
  await clearImages();
  imageRequests.length = 0;
  badge = "stale";

  const response = await fetchNow();

  assert.equal(response.ok, true);
  const images = await getAllImages();
  assert.equal(images.length, ARCHIVE.length);

  const today = images.find((image) => image.urlbase === ARCHIVE[0].urlbase);
  assert.equal(today.size, "UHD");
  assert.equal(today.drk, 0);
  assert.equal(today.copyrightlink, ARCHIVE[0].copyrightlink);

  assert.equal(imageRequests.filter((url) => url.endsWith("_UHD.jpg")).length, 1);
  assert.equal(imageRequests.filter((url) => url.endsWith("_1920x1080.jpg")).length, ARCHIVE.length - 1);
  assert.equal(badge, "");
  assert.equal(storageData.status.state, "downloaded");
  assert.equal(storageData.status.changed, ARCHIVE.length);
});

test("skips images already stored and keeps favorites intact", async () => {
  await clearImages();
  const today = ARCHIVE[0];
  await putImage({
    urlbase: today.urlbase,
    title: "kept",
    copyright: "",
    date: today.startdate,
    blob: new Blob(["original"]),
    fetchedAt: 1,
    size: "UHD",
    favorite: true,
  });
  imageRequests.length = 0;

  const response = await fetchNow();

  assert.equal(response.ok, true);
  const stored = await getImage(today.urlbase);
  assert.equal(stored.favorite, true);
  assert.equal(await stored.blob.text(), "original");
  assert.ok(!imageRequests.some((url) => url.endsWith("_UHD.jpg")));
  assert.equal(storageData.status.changed, ARCHIVE.length - 1);
});

test("reports a badge when the archive is empty", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ images: [] });

  try {
    const response = await fetchNow();
    assert.equal(response.ok, false);
    assert.equal(badge, "!");
    assert.match(storageData.status.message, /noWallpaper/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reschedules the alarm when settings change", async () => {
  createCalls = 0;
  handlers.storage({ settings: { newValue: { updateHour: 9 } } }, "local");
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(createCalls > 0);
});
