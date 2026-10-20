import test from "node:test";
import assert from "node:assert/strict";
import { buildWallpaperUrl, fetchDailyImage, parseDailyImage } from "../src/bing.js";

test("buildWallpaperUrl requests the highest available size", () => {
  const url = buildWallpaperUrl("/th?id=OHR.ElGolfo_ZH-CN8329995759");

  assert.equal(url, "https://www.bing.com/th?id=OHR.ElGolfo_ZH-CN8329995759_UHD.jpg");
});

test("parses the first image from the Bing response", () => {
  const image = parseDailyImage({
    images: [
      {
        urlbase: "/th?id=OHR.ElGolfo_ZH-CN8329995759",
        title: "El Golfo",
        copyright: "Photo by Someone",
        startdate: "20261020",
      },
    ],
  });

  assert.deepEqual(image, {
    urlbase: "/th?id=OHR.ElGolfo_ZH-CN8329995759",
    title: "El Golfo",
    copyright: "Photo by Someone",
    date: "20261020",
  });
});

test("rejects a Bing response without an image", () => {
  assert.throws(() => parseDailyImage({ images: [] }), /no image/);
  assert.throws(() => parseDailyImage({}), /no image/);
});

test("fetches and parses the daily archive response", async () => {
  let requestedUrl;
  const image = await fetchDailyImage({
    fetchImpl: async (url) => {
      requestedUrl = url;
      return Response.json({
        images: [
          {
            urlbase: "/th?id=OHR.ElGolfo_ZH-CN8329995759",
            title: "El Golfo",
            copyright: "Photo by Someone",
            startdate: "20261020",
          },
        ],
      });
    },
    retryDelaysMs: [0],
  });

  assert.match(requestedUrl, /HPImageArchive\.aspx/);
  assert.equal(image.urlbase, "/th?id=OHR.ElGolfo_ZH-CN8329995759");
});
