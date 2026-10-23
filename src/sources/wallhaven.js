import { fetchWithRetry } from "../network.js";
import { localDateKey } from "./date.js";

const API = "https://wallhaven.cc/api/v1/search";
const QUERY = "categories=100&purity=100&atleast=1920x1080&ratios=16x9&sorting=random";

export function buildWallhavenUrl() {
  return `${API}?${QUERY}`;
}

export function parseWallhaven(data, dateKey) {
  const item = data?.data?.[0];
  if (!item?.path) return null;

  return {
    urlbase: item.path,
    downloadUrl: item.path,
    title: item.resolution ? `Wallhaven · ${item.resolution}` : "Wallhaven",
    copyright: item.source || "Wallhaven",
    date: dateKey,
    copyrightlink: item.url ?? "",
    drk: null,
    source: "wallhaven",
  };
}

// Wallhaven 按随机排序返回，每天同步会拿到一张新的 SFW 壁纸。
export async function listWallhaven(options = {}) {
  const { now = new Date(), fetchImpl, retryDelaysMs } = options;

  const requestOptions = { timeoutMs: 15_000 };
  if (fetchImpl) requestOptions.fetchImpl = fetchImpl;
  if (retryDelaysMs) requestOptions.retryDelaysMs = retryDelaysMs;

  const response = await fetchWithRetry(buildWallhavenUrl(), requestOptions);
  return [parseWallhaven(await response.json(), localDateKey(now))].filter(Boolean);
}
