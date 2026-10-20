import { buildWallpaperUrl, fetchDailyImage } from "./bing.js";
import { fetchWithRetry } from "./network.js";
import { deleteExpiredImages, deleteOldestImage, getImage, putImage } from "./store.js";

const ALARM_NAME = "daily-wallpaper";
const IMAGE_TIMEOUT_MS = 30_000;

let runPromise;

function nextSixAM() {
  const date = new Date();
  date.setHours(6, 0, 0, 0);
  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }
  return date.getTime();
}

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { when: nextSixAM(), periodInMinutes: 24 * 60 });
  }
}

async function saveStatus(status) {
  await chrome.storage.local.set({ status: { ...status, updatedAt: Date.now() } });
}

async function storeImage(image) {
  try {
    await putImage(image);
  } catch (error) {
    if (error?.name !== "QuotaExceededError") throw error;

    while (await deleteOldestImage()) {
      try {
        await putImage(image);
        return;
      } catch (retryError) {
        if (retryError?.name !== "QuotaExceededError") throw retryError;
      }
    }

    throw error;
  }
}

async function downloadDailyWallpaper() {
  const image = await fetchDailyImage();
  await deleteExpiredImages();

  const existing = await getImage(image.urlbase);
  if (existing) {
    await saveStatus({ state: "skipped" });
  } else {
    const response = await fetchWithRetry(buildWallpaperUrl(image.urlbase), {
      timeoutMs: IMAGE_TIMEOUT_MS,
    });
    const blob = await response.blob();
    await storeImage({ ...image, blob, fetchedAt: Date.now() });
    await saveStatus({ state: "downloaded" });
  }
}

async function runSafelyOnce() {
  try {
    await downloadDailyWallpaper();
    return { ok: true };
  } catch (error) {
    const message = String(error);
    await saveStatus({ state: "error", message }).catch(() => {});
    return { ok: false, error: message };
  }
}

function runSafely() {
  runPromise ??= runSafelyOnce().finally(() => {
    runPromise = undefined;
  });
  return runPromise;
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  runSafely();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  runSafely();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runSafely();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "fetch-now") {
    runSafely().then(sendResponse, (error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});
