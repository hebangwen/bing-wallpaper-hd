import test from "node:test";
import assert from "node:assert/strict";
import { getSource } from "../src/sources/index.js";
import {
  buildFeedUrl,
  listWikimedia,
  parseWikimediaDay,
  resizeThumbUrl,
} from "../src/sources/wikimedia.js";

const FEED = {
  image: {
    title: "File:Example.jpg",
    description: { text: "An example picture" },
    file_page: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    image: { source: "https://upload.wikimedia.org/example.jpg" },
    thumbnail: {
      source: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Example.jpg/640px-Example.jpg",
    },
  },
};

test("builds the featured feed url", () => {
  assert.equal(
    buildFeedUrl("en", new Date(Date.UTC(2026, 9, 22))),
    "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/10/22",
  );
});

test("parses the picture of the day", () => {
  assert.deepEqual(parseWikimediaDay(FEED, "20261022", "wikimedia-en"), {
    urlbase: "https://upload.wikimedia.org/example.jpg",
    downloadUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Example.jpg/1920px-Example.jpg",
    title: "File:Example.jpg",
    copyright: "An example picture",
    date: "20261022",
    copyrightlink: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    drk: null,
    source: "wikimedia-en",
  });

  assert.equal(parseWikimediaDay({}, "20261022", "wikimedia-en"), null);
  assert.equal(parseWikimediaDay(null, "20261022", "wikimedia-en"), null);
});

test("upgrades the thumbnail width and leaves plain urls alone", () => {
  assert.equal(
    resizeThumbUrl("https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/A.jpg/640px-A.jpg"),
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/A.jpg/1920px-A.jpg",
  );
  assert.equal(resizeThumbUrl("https://upload.wikimedia.org/a.jpg"), "https://upload.wikimedia.org/a.jpg");
});

test("lists at most three days and skips empty days", async () => {
  const requested = [];
  const images = await listWikimedia("en", 5, {
    now: new Date(Date.UTC(2026, 9, 23)),
    retryDelaysMs: [0],
    fetchImpl: async (url) => {
      requested.push(url);
      return requested.length === 2 ? Response.json({}) : Response.json(FEED);
    },
  });

  assert.equal(requested.length, 3);
  assert.deepEqual(
    images.map((image) => image.date),
    ["20261023", "20261021"],
  );
});

test("falls back to bing for unknown sources", () => {
  assert.equal(getSource("nope").id, "bing");
  assert.equal(getSource("wikimedia-zh").supportsQuality, false);
  assert.equal(getSource("bing").supportsQuality, true);
});
