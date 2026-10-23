import { imageKeyOf } from "./images.js";

const DB_NAME = "wallpapers";
const STORE = "images";
const FETCHED_AT_INDEX = "fetchedAt";
const DATE_INDEX = "date";
const IMAGE_KEY_INDEX = "imageKey";
const DB_VERSION = 5;

export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

let dbPromise;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const store =
        event.oldVersion === 0
          ? db.createObjectStore(STORE, { keyPath: "urlbase" })
          : request.transaction.objectStore(STORE);

      if (event.oldVersion === 1) {
        store.clear();
      }
      if (!store.indexNames.contains(FETCHED_AT_INDEX)) {
        store.createIndex(FETCHED_AT_INDEX, "fetchedAt");
      }
      if (!store.indexNames.contains(DATE_INDEX)) {
        store.createIndex(DATE_INDEX, "date");
      }
      if (!store.indexNames.contains(IMAGE_KEY_INDEX)) {
        store.createIndex(IMAGE_KEY_INDEX, "imageKey");
      }

      // v5：给旧记录补上去重用的 imageKey。
      if (event.oldVersion > 0 && event.oldVersion < 5) {
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;

          const value = cursor.value;
          if (!value.imageKey) {
            cursor.update({ ...value, imageKey: imageKeyOf(value) });
          }
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

function getDatabase() {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = undefined;
      throw error;
    });
  }
  return dbPromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function visitCursor(request, visit) {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || visit(cursor) === false) {
        resolve();
        return;
      }
      cursor.continue();
    };
  });
}

async function transact(mode, operation) {
  const db = await getDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result;

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));

    Promise.resolve(operation(tx.objectStore(STORE))).then(
      (value) => {
        result = value;
      },
      (error) => {
        try {
          tx.abort();
        } catch {}
        reject(error);
      },
    );
  });
}

export function putImage(image) {
  return transact("readwrite", (store) => requestResult(store.put(image)));
}

export function getImage(urlbase) {
  return transact("readonly", (store) => requestResult(store.get(urlbase)));
}

export function getImageByKey(key) {
  return transact("readonly", (store) =>
    requestResult(store.index(IMAGE_KEY_INDEX).getAll(key)).then((images) => images[0] ?? null),
  );
}

export function getAllImages() {
  return transact("readonly", (store) => requestResult(store.getAll()));
}

export function getLatestImage() {
  return transact("readonly", (store) =>
    requestResult(store.index(DATE_INDEX).openCursor(null, "prev")).then(
      (cursor) => cursor?.value ?? null,
    ),
  );
}

export function deleteImage(urlbase) {
  return transact("readwrite", (store) => requestResult(store.delete(urlbase)));
}

export function setFavorite(urlbase, favorite) {
  return transact("readwrite", async (store) => {
    const image = await requestResult(store.get(urlbase));
    if (!image) return null;

    const updated = { ...image, favorite: Boolean(favorite) };
    await requestResult(store.put(updated));
    return updated;
  });
}

function dateKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function deleteExpiredImages(now = Date.now(), retentionMs = RETENTION_MS) {
  const cutoff = dateKey(now - retentionMs);

  return transact("readwrite", async (store) => {
    let deleted = 0;

    await visitCursor(store.index(DATE_INDEX).openCursor(), (cursor) => {
      const { date, favorite } = cursor.value;
      if (date >= cutoff) return false;
      if (favorite) return;
      cursor.delete();
      deleted += 1;
    });

    return deleted;
  });
}

// 配额不足时淘汰最旧的非收藏图片；返回 null 表示已无图可删。
export function deleteOldestImage() {
  return transact("readwrite", async (store) => {
    let image = null;

    await visitCursor(store.index(FETCHED_AT_INDEX).openCursor(), (cursor) => {
      if (cursor.value.favorite) return;
      image = cursor.value;
      cursor.delete();
      return false;
    });

    return image;
  });
}

// 同一张图可能因为切换语言存成不同 urlbase，这里按 imageKey 合并。
export async function pruneDuplicateImages() {
  const all = await getAllImages();
  const groups = new Map();

  for (const image of all) {
    const key = `${image.source ?? "bing"}|${imageKeyOf(image)}`;
    const list = groups.get(key) ?? [];
    list.push(image);
    groups.set(key, list);
  }

  const doomed = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;

    const keep =
      list.find((image) => image.favorite) ??
      [...list].sort((a, b) => (b.fetchedAt ?? 0) - (a.fetchedAt ?? 0))[0];

    for (const image of list) {
      if (image !== keep && !image.favorite) doomed.push(image.urlbase);
    }
  }

  if (doomed.length === 0) return 0;

  return transact("readwrite", (store) => {
    for (const urlbase of doomed) store.delete(urlbase);
    return doomed.length;
  });
}

// 切换图源时清掉其它源的历史图，收藏的保留。
export function deleteImagesExceptSource(source) {
  return transact("readwrite", async (store) => {
    let deleted = 0;

    await visitCursor(store.openCursor(), (cursor) => {
      const image = cursor.value;
      if (image.favorite) return;
      if ((image.source ?? "bing") === source) return;
      cursor.delete();
      deleted += 1;
    });

    return deleted;
  });
}

export function clearImages({ keepFavorites = false } = {}) {
  return transact("readwrite", async (store) => {
    let deleted = 0;

    await visitCursor(store.openCursor(), (cursor) => {
      if (keepFavorites && cursor.value.favorite) return;
      cursor.delete();
      deleted += 1;
    });

    return deleted;
  });
}
