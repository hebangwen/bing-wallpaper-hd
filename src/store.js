const DB_NAME = "wallpapers";
const STORE = "images";
const FETCHED_AT_INDEX = "fetchedAt";
const DB_VERSION = 3;

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

export function getAllImages() {
  return transact("readonly", (store) => requestResult(store.getAll()));
}

export function getLatestImage() {
  return transact("readonly", (store) =>
    requestResult(store.index(FETCHED_AT_INDEX).openCursor(null, "prev")).then(
      (cursor) => cursor?.value ?? null,
    ),
  );
}

export function deleteExpiredImages(now = Date.now()) {
  const cutoff = now - RETENTION_MS;

  return transact("readwrite", async (store) => {
    let deleted = 0;

    await visitCursor(store.index(FETCHED_AT_INDEX).openCursor(), (cursor) => {
      if (cursor.value.fetchedAt >= cutoff) return false;
      cursor.delete();
      deleted += 1;
    });

    return deleted;
  });
}

export function deleteOldestImage() {
  return transact("readwrite", async (store) => {
    let image = null;

    await visitCursor(store.index(FETCHED_AT_INDEX).openCursor(), (cursor) => {
      image = cursor.value;
      cursor.delete();
      return false;
    });

    return image;
  });
}
