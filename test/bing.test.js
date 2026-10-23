import test from "node:test";
import assert from "node:assert/strict";
import {
  buildApiUrl,
  buildWallpaperUrl,
  fetchArchive,
  fetchDailyImage,
  parseArchive,
  parseDailyImage,
} from "../src/bing.js";

const IMAGE = {
  urlbase: "/th?id=OHR.ElGolfo_ZH-CN8329995759",
  title: "El Golfo",
  copyright: "Photo by Someone",
  startdate: "20261020",
  copyrightlink: "https://www.bing.com/search?q=El+Golfo",
  drk: 1,
};

test("buildWallpaperUrl requests the highest available size", () => {
  const url = buildWallpaperUrl("/th?id=OHR.ElGolfo_ZH-CN8329995759");

  assert.equal(url, "https://www.bing.com/th?id=OHR.ElGolfo_ZH-CN8329995759_UHD.jpg");
});

test("buildWallpaperUrl honours a smaller size and rejects unknown ones", () => {
  assert.equal(
    buildWallpaperUrl("/th?id=OHR.ElGolfo_ZH-CN8329995759", "1920x1080"),
    "https://www.bing.com/th?id=OHR.ElGolfo_ZH-CN8329995759_1920x1080.jpg",
  );
  assert.equal(
    buildWallpaperUrl("/th?id=OHR.ElGolfo_ZH-CN8329995759", "1080p"),
    "https://www.bing.com/th?id=OHR.ElGolfo_ZH-CN8329995759_UHD.jpg",
  );
});

test("buildApiUrl carries the archive size and market", () => {
  const url = new URL(buildApiUrl({ n: 8, market: "en-US" }));

  assert.equal(url.searchParams.get("n"), "8");
  assert.equal(url.searchParams.get("mkt"), "en-US");
  assert.equal(url.searchParams.get("idx"), "0");
  assert.equal(url.searchParams.get("format"), "js");
});

test("builds a server-scaled url for a custom size", () => {
  assert.equal(
    buildWallpaperUrl("/th?id=OHR.ElGolfo_ZH-CN8329995759", "2560x1440"),
    "https://www.bing.com/th?id=OHR.ElGolfo_ZH-CN8329995759_UHD.jpg&w=2560&h=1440&rs=1&c=4",
  );
  assert.equal(
    buildWallpaperUrl("/th?id=OHR.ElGolfo_ZH-CN8329995759", "1024x768"),
    "https://www.bing.com/th?id=OHR.ElGolfo_ZH-CN8329995759_1920x1080.jpg&w=1024&h=768&rs=1&c=4",
  );
  assert.equal(
    buildWallpaperUrl("/th?id=OHR.X", "1280x720"),
    "https://www.bing.com/th?id=OHR.X_1280x720.jpg",
  );
});

test("parses the first image from the Bing response", () => {
  assert.deepEqual(parseDailyImage({ images: [IMAGE] }), {
    urlbase: "/th?id=OHR.ElGolfo_ZH-CN8329995759",
    title: "El Golfo",
    copyright: "Photo by Someone",
    date: "20261020",
    copyrightlink: "https://www.bing.com/search?q=El+Golfo",
    drk: 1,
  });
});

test("keeps missing optional fields predictable", () => {
  const image = parseDailyImage({
    images: [{ urlbase: "/th?id=OHR.Minimal" }],
  });

  assert.deepEqual(image, {
    urlbase: "/th?id=OHR.Minimal",
    title: "",
    copyright: "",
    date: "",
    copyrightlink: "",
    drk: null,
  });
});

test("parses the whole archive and drops entries without a urlbase", () => {
  const images = parseArchive({ images: [IMAGE, { title: "broken" }, { ...IMAGE, urlbase: "/th?id=B" }] });

  assert.deepEqual(
    images.map((image) => image.urlbase),
    ["/th?id=OHR.ElGolfo_ZH-CN8329995759", "/th?id=B"],
  );
  assert.deepEqual(parseArchive(null), []);
  assert.deepEqual(parseArchive({ images: "nope" }), []);
});

test("rejects a Bing response without an image", () => {
  assert.throws(() => parseDailyImage({ images: [] }), /no image/);
  assert.throws(() => parseDailyImage({}), /no image/);
});

test("fetches and parses the daily archive response", async () => {
  let requestedUrl;
  const image = await fetchDailyImage({
    market: "ja-JP",
    fetchImpl: async (url) => {
      requestedUrl = url;
      return Response.json({ images: [IMAGE] });
    },
    retryDelaysMs: [0],
  });

  assert.match(requestedUrl, /HPImageArchive\.aspx/);
  assert.match(requestedUrl, /mkt=ja-JP/);
  assert.equal(image.urlbase, "/th?id=OHR.ElGolfo_ZH-CN8329995759");
});

test("fetches the backfill window in one request", async () => {
  let requestedUrl;
  const images = await fetchArchive({
    n: 8,
    market: "en-US",
    fetchImpl: async (url) => {
      requestedUrl = url;
      return Response.json({ images: [IMAGE, { ...IMAGE, urlbase: "/th?id=Second" }] });
    },
    retryDelaysMs: [0],
  });

  assert.equal(new URL(requestedUrl).searchParams.get("n"), "8");
  assert.equal(images.length, 2);
});
