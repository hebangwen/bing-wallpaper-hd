import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  RETENTION_MS,
  deleteExpiredImages,
  deleteOldestImage,
  getAllImages,
  getLatestImage,
  putImage,
} from "../src/store.js";

function image(urlbase, fetchedAt) {
  return {
    urlbase,
    title: urlbase,
    copyright: "",
    date: urlbase,
    blob: new Blob([urlbase]),
    fetchedAt,
  };
}

async function clearImages() {
  while (await deleteOldestImage()) {}
}

test("returns the newest image without loading the full stored set", async () => {
  await clearImages();
  await putImage(image("old", 1));
  await putImage(image("new", 2));

  assert.equal((await getLatestImage()).urlbase, "new");
  assert.equal((await deleteOldestImage()).urlbase, "old");
  assert.deepEqual(
    (await getAllImages()).map((entry) => entry.urlbase),
    ["new"],
  );

  await clearImages();
});

test("deletes only images past the retention window", async () => {
  await clearImages();
  const now = Date.now();
  await putImage(image("expired", now - RETENTION_MS - 1));
  await putImage(image("boundary", now - RETENTION_MS));
  await putImage(image("fresh", now - 1));

  assert.equal(await deleteExpiredImages(now), 1);
  assert.deepEqual(
    (await getAllImages()).map((entry) => entry.urlbase).sort(),
    ["boundary", "fresh"],
  );

  await clearImages();
});

test("returns null when there is no image to delete", async () => {
  await clearImages();
  assert.equal(await getLatestImage(), null);
  assert.equal(await deleteOldestImage(), null);
  assert.equal(await deleteExpiredImages(), 0);
});
