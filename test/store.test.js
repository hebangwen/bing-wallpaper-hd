import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  RETENTION_MS,
  clearImages,
  deleteExpiredImages,
  deleteImagesExceptSource,
  deleteOldestImage,
  getAllImages,
  getImage,
  getLatestImage,
  getLatestImageBySource,
  pruneDuplicateImages,
  putImage,
  setFavorite,
} from "../src/store.js";

function dateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function image(urlbase, fetchedAt, extra = {}) {
  return {
    urlbase,
    title: urlbase,
    copyright: "",
    date: dateKey(),
    blob: new Blob([urlbase]),
    fetchedAt,
    ...extra,
  };
}

async function resetImages() {
  await clearImages();
}

test("returns the newest image without loading the full stored set", async () => {
  await resetImages();
  await putImage({ ...image("old", 1), date: "20261019" });
  await putImage({ ...image("new", 2), date: "20261020" });

  assert.equal((await getLatestImage()).urlbase, "new");
  assert.equal((await deleteOldestImage()).urlbase, "old");
  assert.deepEqual(
    (await getAllImages()).map((entry) => entry.urlbase),
    ["new"],
  );

  await resetImages();
});

test("returns the newest image for the requested source", async () => {
  await resetImages();
  await putImage({ ...image("bing-1", 1), source: "bing", date: "20261022" });
  await putImage({ ...image("picsum-1", 2), source: "picsum", date: "20261023" });

  assert.equal((await getLatestImageBySource("bing")).urlbase, "bing-1");
  assert.equal((await getLatestImageBySource("picsum")).urlbase, "picsum-1");
  assert.equal(await getLatestImageBySource("wallhaven"), null);

  await resetImages();
});

test("returns the image with the newest date, not the last downloaded", async () => {
  await resetImages();
  await putImage({ ...image("today", 1), date: "20261021" });
  await putImage({ ...image("yesterday", 2), date: "20261020" });

  assert.equal((await getLatestImage()).urlbase, "today");

  await resetImages();
});

test("deletes only images past the retention window", async () => {
  await resetImages();
  const now = Date.now();
  await putImage({ ...image("expired", now), date: dateKey(-8) });
  await putImage({ ...image("boundary", now), date: dateKey(-7) });
  await putImage({ ...image("fresh", now), date: dateKey(0) });

  assert.equal(await deleteExpiredImages(now), 1);
  assert.deepEqual(
    (await getAllImages()).map((entry) => entry.urlbase).sort(),
    ["boundary", "fresh"],
  );

  await resetImages();
});

test("accepts a shorter retention window", async () => {
  await resetImages();
  const now = Date.now();
  await putImage({ ...image("two-days", now), date: dateKey(-2) });
  await putImage({ ...image("fresh", now), date: dateKey(0) });

  assert.equal(await deleteExpiredImages(now, 24 * 60 * 60 * 1000), 1);
  assert.deepEqual(
    (await getAllImages()).map((entry) => entry.urlbase),
    ["fresh"],
  );

  await resetImages();
});

test("keeps favorites when pruning expired images", async () => {
  await resetImages();
  const now = Date.now();
  await putImage({ ...image("expired-favorite", now), date: dateKey(-8), favorite: true });
  await putImage({ ...image("expired", now), date: dateKey(-8) });

  assert.equal(await deleteExpiredImages(now), 1);
  assert.deepEqual(
    (await getAllImages()).map((entry) => entry.urlbase),
    ["expired-favorite"],
  );

  await resetImages();
});

test("skips favorites when evicting the oldest image", async () => {
  await resetImages();
  await putImage(image("old-favorite", 1, { favorite: true }));
  await putImage(image("plain", 2));

  assert.equal((await deleteOldestImage()).urlbase, "plain");
  assert.equal(await deleteOldestImage(), null);
  assert.equal((await getAllImages()).length, 1);

  await resetImages();
});

test("toggles the favorite flag without dropping the bitmap", async () => {
  await resetImages();
  await putImage(image("entry", 1));

  const updated = await setFavorite("entry", true);
  assert.equal(updated.favorite, true);
  assert.equal(updated.blob.size, 5);

  const stored = await getImage("entry");
  assert.equal(stored.favorite, true);
  assert.equal(stored.title, "entry");

  assert.equal(await setFavorite("missing", true), null);

  await resetImages();
});

test("clears images while keeping favorites on request", async () => {
  await resetImages();
  await putImage(image("favorite", 1, { favorite: true }));
  await putImage(image("plain", 2));

  assert.equal(await clearImages({ keepFavorites: true }), 1);
  assert.deepEqual(
    (await getAllImages()).map((entry) => entry.urlbase),
    ["favorite"],
  );

  assert.equal(await clearImages(), 1);
  assert.equal((await getAllImages()).length, 0);
});

test("drops images from other sources but keeps favorites", async () => {
  await resetImages();
  await putImage({ ...image("bing-1", 1), source: "bing" });
  await putImage({ ...image("wiki-1", 2), source: "wikimedia-en" });
  await putImage({ ...image("wiki-fav", 3), source: "wikimedia-en", favorite: true });

  assert.equal(await deleteImagesExceptSource("wikimedia-en"), 1);
  assert.deepEqual(
    (await getAllImages()).map((entry) => entry.urlbase).sort(),
    ["wiki-1", "wiki-fav"],
  );

  await resetImages();
});

test("prunes images that only differ by localized urlbase", async () => {
  await resetImages();
  await putImage({ ...image("zh-variant", 1), source: "bing", imageKey: "OHR.Wolves" });
  await putImage({ ...image("en-variant", 2), source: "bing", imageKey: "OHR.Wolves" });
  await putImage({ ...image("other", 3), source: "bing", imageKey: "OHR.Other" });

  assert.equal(await pruneDuplicateImages(), 1);
  assert.deepEqual(
    (await getAllImages()).map((entry) => entry.urlbase).sort(),
    ["en-variant", "other"],
  );

  await resetImages();
});

test("never prunes a favorite duplicate", async () => {
  await resetImages();
  await putImage({ ...image("fav", 1), source: "bing", imageKey: "OHR.Wolves", favorite: true });
  await putImage({ ...image("plain", 2), source: "bing", imageKey: "OHR.Wolves" });

  assert.equal(await pruneDuplicateImages(), 1);
  assert.deepEqual(
    (await getAllImages()).map((entry) => entry.urlbase),
    ["fav"],
  );

  await resetImages();
});

test("returns null when there is no image to delete", async () => {
  await resetImages();
  assert.equal(await getLatestImage(), null);
  assert.equal(await deleteOldestImage(), null);
  assert.equal(await deleteExpiredImages(), 0);
});
