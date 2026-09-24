const DB_NAME = "wallpapers";
const STORE = "images";

export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "urlbase" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, fn) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function putImage(image) {
  return transact("readwrite", (store) => store.put(image));
}

export function getImage(urlbase) {
  return transact("readonly", (store) => store.get(urlbase));
}

export function getAllImages() {
  return transact("readonly", (store) => store.getAll());
}

export async function deleteExpiredImages(now = Date.now()) {
  const images = await getAllImages();
  const expired = images.filter((image) => now - image.fetchedAt > RETENTION_MS);
  for (const image of expired) {
    await transact("readwrite", (store) => store.delete(image.urlbase));
  }
  return expired.length;
}
