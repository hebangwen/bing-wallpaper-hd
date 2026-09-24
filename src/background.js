import { fetchDailyImage } from "./bing.js";
import { pickImageSize, buildImageUrl } from "./resolution.js";
import { getImage, putImage, deleteExpiredImages } from "./store.js";

const ALARM_NAME = "daily-wallpaper";

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

async function getDeviceResolution() {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: "src/offscreen.html",
      reasons: ["DOM_SCRAPING"],
      justification: "读取屏幕物理分辨率以选择适配的壁纸尺寸",
    });
  }
  try {
    return await chrome.runtime.sendMessage({ type: "get-device-resolution" });
  } finally {
    await chrome.offscreen.closeDocument();
  }
}

async function saveStatus(status) {
  await chrome.storage.local.set({ status: { ...status, updatedAt: Date.now() } });
}

export async function downloadDailyWallpaper() {
  const image = await fetchDailyImage();
  const device = await getDeviceResolution();
  const size = pickImageSize(device.width, device.height);

  const existing = await getImage(image.urlbase);
  if (existing) {
    await saveStatus({ state: "skipped", image, size, device });
  } else {
    const url = buildImageUrl(image.urlbase, size);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`image fetch returned ${response.status}`);
    }
    const blob = await response.blob();
    await putImage({ ...image, size, blob, fetchedAt: Date.now() });
    await saveStatus({ state: "downloaded", image, size, device });
  }

  await deleteExpiredImages();
}

async function runSafely() {
  try {
    await downloadDailyWallpaper();
  } catch (error) {
    await saveStatus({ state: "error", message: String(error) });
  }
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
    downloadDailyWallpaper()
      .then(() => sendResponse({ ok: true }))
      .catch(async (error) => {
        await saveStatus({ state: "error", message: String(error) });
        sendResponse({ ok: false, error: String(error) });
      });
    return true;
  }
});
