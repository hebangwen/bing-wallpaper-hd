import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

test("upgrades a version 2 database with the fetchedAt index", async () => {
  const open = indexedDB.open("wallpapers", 2);
  await new Promise((resolve, reject) => {
    open.onupgradeneeded = () => {
      open.result.createObjectStore("images", { keyPath: "urlbase" });
    };
    open.onsuccess = resolve;
    open.onerror = () => reject(open.error);
  });

  const db = open.result;
  await new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    tx.objectStore("images").put({
      urlbase: "existing",
      title: "Existing",
      copyright: "",
      date: "20261018",
      blob: new Blob(["existing"]),
      fetchedAt: 1,
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  const { getLatestImage, deleteOldestImage } = await import("../src/store.js");

  assert.equal((await getLatestImage()).urlbase, "existing");
  assert.equal((await deleteOldestImage()).urlbase, "existing");
});
