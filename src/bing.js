import { fetchWithRetry } from "./network.js";
import { PRESET_QUALITIES, parseQuality } from "./settings.js";

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

// 预设档位使用 Bing 预生成的资源；自定义宽高从最接近的原生尺寸请求服务端缩放。
export function buildWallpaperUrl(urlbase, size = DEFAULT_QUALITY) {
  const quality = parseQuality(size) ?? DEFAULT_QUALITY;

  if (PRESET_QUALITIES.includes(quality)) {
    return `https://www.bing.com${urlbase}_${quality}.jpg`;
  }

  const [width, height] = quality.split("x").map(Number);
  const source = width > 1920 || height > 1080 ? "UHD" : "1920x1080";
  const separator = urlbase.includes("?") ? "&" : "?";
  return `https://www.bing.com${urlbase}_${source}.jpg${separator}w=${width}&h=${height}&rs=1&c=4`;
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
