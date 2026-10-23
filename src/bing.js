import { fetchWithRetry } from "./network.js";
import { QUALITIES } from "./settings.js";

const API_URL = "https://www.bing.com/HPImageArchive.aspx";
const DEFAULT_QUALITY = "UHD";

export function buildApiUrl({ n = 1, market = "zh-CN" } = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("format", "js");
  url.searchParams.set("idx", "0");
  url.searchParams.set("n", String(n));
  url.searchParams.set("mkt", market);
  return url.toString();
}

export function buildWallpaperUrl(urlbase, size = DEFAULT_QUALITY) {
  const quality = QUALITIES.includes(size) ? size : DEFAULT_QUALITY;
  return `https://www.bing.com${urlbase}_${quality}.jpg`;
}

function parseImage(image) {
  if (!image?.urlbase) return null;

  return {
    urlbase: image.urlbase,
    title: image.title ?? "",
    copyright: image.copyright ?? "",
    date: image.startdate ?? "",
    copyrightlink: image.copyrightlink ?? "",
    drk: image.drk === 0 || image.drk === 1 ? image.drk : null,
  };
}

export function parseArchive(data) {
  const images = Array.isArray(data?.images) ? data.images : [];
  return images.map(parseImage).filter(Boolean);
}

export function parseDailyImage(data) {
  const [image] = parseArchive(data);
  if (!image) {
    throw new Error("Bing API returned no image");
  }
  return image;
}

export async function fetchArchive({ n = 1, market = "zh-CN", ...options } = {}) {
  const response = await fetchWithRetry(buildApiUrl({ n, market }), options);
  return parseArchive(await response.json());
}

export async function fetchDailyImage(options = {}) {
  const [image] = await fetchArchive({ ...options, n: 1 });
  if (!image) {
    throw new Error("Bing API returned no image");
  }
  return image;
}
