import { fetchWithRetry } from "../network.js";

const FEED_URL = "https://api.wikimedia.org/feed/v1/wikipedia";
export const WIKIMEDIA_MAX_BACKFILL = 3;

function segments(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ];
}

function dateKey(date) {
  return segments(date).join("");
}

export function buildFeedUrl(language, date) {
  const [year, month, day] = segments(date);
  return `${FEED_URL}/${language}/featured/${year}/${month}/${day}`;
}

export const WIKIMEDIA_THUMB_WIDTH = 1920;

// Wikimedia 原图可能几十 MB，下载 1920px 缩略图足以铺满屏幕。
export function resizeThumbUrl(url, width = WIKIMEDIA_THUMB_WIDTH) {
  if (!url || !url.includes("/thumb/")) return url;
  return url.replace(/\/(\d+)px-/, `/${width}px-`);
}

export function parseWikimediaDay(data, dayKey, source) {
  const image = data?.image;
  const src = image?.image?.source;
  if (!src) return null;

  const thumbnail = image.thumbnail?.source;

  return {
    urlbase: src,
    downloadUrl: thumbnail ? resizeThumbUrl(thumbnail) : src,
    title: image.title ?? "",
    copyright: image.description?.text ?? "",
    date: dayKey,
    copyrightlink: image.file_page ?? "",
    drk: null,
    source,
  };
}

// Wikimedia 只提供每天一张原图，回填上限压到 3 天，避免一次拉几十 MB。
export async function listWikimedia(language, count, options = {}) {
  const { now = new Date(), fetchImpl, retryDelaysMs } = options;
  const days = [];

  for (let index = 0; index < Math.min(count, WIKIMEDIA_MAX_BACKFILL); index += 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - index);
    days.push(date);
  }

  const requestOptions = { timeoutMs: 15_000 };
  if (fetchImpl) requestOptions.fetchImpl = fetchImpl;
  if (retryDelaysMs) requestOptions.retryDelaysMs = retryDelaysMs;

  const images = await Promise.all(
    days.map(async (date) => {
      try {
        const response = await fetchWithRetry(buildFeedUrl(language, date), requestOptions);
        return parseWikimediaDay(await response.json(), dateKey(date), `wikimedia-${language}`);
      } catch {
        return null;
      }
    }),
  );

  return images.filter(Boolean);
}
