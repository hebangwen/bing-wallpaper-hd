import { buildWallpaperUrl, fetchArchive } from "./bing.js";
import { fetchWithRetry } from "./network.js";
import {
  deleteExpiredImages,
  deleteOldestImage,
  getImage,
  putImage,
} from "./store.js";
import {
  backfillCount,
  loadSettings,
  normalizeSettings,
  nextRunAt,
  qualityFor,
  retentionMsFor,
} from "./settings.js";
import { makeThumbnail } from "./thumbnail.js";

const ALARM_NAME = "daily-wallpaper";
const IMAGE_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [1_000, 3_000];
const BADGE_ERROR = "!";

let runPromise;

async function scheduleAlarm(updateHour) {
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, {
    when: nextRunAt(updateHour),
    periodInMinutes: 24 * 60,
  });
}

async function saveStatus(status) {
  await chrome.storage.local.set({ status: { ...status, updatedAt: Date.now() } });
}

function setBadge(text) {
  chrome.action.setBadgeText({ text });
  if (text) {
    chrome.action.setBadgeBackgroundColor({ color: "#c0392b" });
  }
}

async function ensureThumbnail(image) {
  if (image.thumb || !image.blob) return image;

  const thumb = await makeThumbnail(image.blob);
  if (!thumb) return image;

  const updated = { ...image, thumb };
  await putImage(updated);
  return updated;
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

async function downloadOne(entry, size) {
  const existing = await getImage(entry.urlbase);
  // 1.1.x 只下载 UHD，没有 size 字段，按 UHD 处理避免升级后重复下载。
  const storedSize = existing?.size ?? "UHD";

  if (existing && storedSize === size) {
    await ensureThumbnail(existing);
    return "skipped";
  }

  const response = await fetchWithRetry(buildWallpaperUrl(entry.urlbase, size), {
    timeoutMs: IMAGE_TIMEOUT_MS,
    retryDelaysMs: RETRY_DELAYS_MS,
  });
  const blob = await response.blob();
  const thumb = await makeThumbnail(blob);

  await storeImage({
    ...entry,
    size,
    blob,
    ...(thumb ? { thumb } : {}),
    ...(existing?.favorite ? { favorite: true } : {}),
    fetchedAt: Date.now(),
  });

  return existing ? "updated" : "downloaded";
}

async function syncWallpapers() {
  const settings = await loadSettings();
  await deleteExpiredImages(Date.now(), retentionMsFor(settings.retentionDays));

  const archive = await fetchArchive({
    n: backfillCount(settings.retentionDays),
    market: settings.market,
  });
  if (archive.length === 0) throw new Error("Bing API returned no image");

  const results = [];
  for (const [index, entry] of archive.entries()) {
    const size = qualityFor(settings.quality, index === 0);
    try {
      results.push(await downloadOne(entry, size));
    } catch (error) {
      results.push("error");
      console.warn(`wallpaper ${entry.urlbase} failed`, error);
    }
  }

  const failed = results.filter((result) => result === "error").length;
  const succeeded = results.length - failed;
  if (succeeded === 0) throw new Error("所有壁纸下载失败");

  const changed = results.filter(
    (result) => result === "downloaded" || result === "updated",
  ).length;

  await saveStatus({ state: changed > 0 ? "downloaded" : "skipped", changed, failed });
  setBadge("");
  return { changed, failed };
}

async function runSafelyOnce() {
  try {
    return { ok: true, ...(await syncWallpapers()) };
  } catch (error) {
    const message = String(error?.message ?? error);
    await saveStatus({ state: "error", message }).catch(() => {});
    setBadge(BADGE_ERROR);
    return { ok: false, error: message };
  }
}

function runSafely() {
  runPromise ??= runSafelyOnce().finally(() => {
    runPromise = undefined;
  });
  return runPromise;
}

function rescheduleAndPrune() {
  return loadSettings().then(async (settings) => {
    await scheduleAlarm(settings.updateHour);
    await deleteExpiredImages(Date.now(), retentionMsFor(settings.retentionDays));
  });
}

chrome.runtime.onInstalled.addListener(() => {
  rescheduleAndPrune().catch(() => {});
  runSafely();
});

chrome.runtime.onStartup.addListener(() => {
  rescheduleAndPrune().catch(() => {});
  runSafely();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  // 每次触发后重算下一次时间，避免长期运行后的时钟漂移。
  rescheduleAndPrune().catch(() => {});
  runSafely();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.settings) return;
  const settings = normalizeSettings(changes.settings.newValue);
  scheduleAlarm(settings.updateHour).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "fetch-now") {
    runSafely().then(sendResponse, (error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "reschedule") {
    rescheduleAndPrune().then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: String(error) }),
    );
    return true;
  }
});
