import { fetchWithRetry } from "./network.js";

const API_URL = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN";

export function buildWallpaperUrl(urlbase) {
  return `https://www.bing.com${urlbase}_UHD.jpg`;
}

export function parseDailyImage(data) {
  const image = data?.images?.[0];
  if (!image?.urlbase) {
    throw new Error("Bing API returned no image");
  }
  return {
    urlbase: image.urlbase,
    title: image.title ?? "",
    copyright: image.copyright ?? "",
    date: image.startdate ?? "",
  };
}

export async function fetchDailyImage(options) {
  const response = await fetchWithRetry(API_URL, options);
  return parseDailyImage(await response.json());
}
