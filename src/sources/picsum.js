import { localDateKey } from "./date.js";

const API = "https://picsum.photos";

export function buildPicsumUrl(seed) {
  return `${API}/seed/${seed}/1920/1080`;
}

export function createPicsumEntry(dateKey) {
  const url = buildPicsumUrl(dateKey);

  return {
    urlbase: url,
    downloadUrl: url,
    title: "Lorem Picsum",
    copyright: "Photo from Unsplash via Lorem Picsum",
    date: dateKey,
    copyrightlink: "https://picsum.photos",
    drk: null,
    source: "picsum",
  };
}

// Picsum 用日期做 seed，同一天返回同一张 1920×1080 摄影。
export function listPicsum({ now = new Date() } = {}) {
  return [createPicsumEntry(localDateKey(now))];
}
