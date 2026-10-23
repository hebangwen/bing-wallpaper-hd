import { buildWallpaperUrl, fetchArchive } from "../bing.js";
import { listPicsum } from "./picsum.js";
import { listWallhaven } from "./wallhaven.js";
import { listWikimedia } from "./wikimedia.js";

export const SOURCE_LABEL_KEYS = {
  bing: "sourceBing",
  "wikimedia-en": "sourceWikimediaEn",
  "wikimedia-zh": "sourceWikimediaZh",
  wallhaven: "sourceWallhaven",
  picsum: "sourcePicsum",
};

export const SOURCES = {
  bing: {
    id: "bing",
    supportsQuality: true,
    async listImages({ count, market }) {
      const images = await fetchArchive({ n: count, market });
      return images.map((image) => ({ ...image, source: "bing" }));
    },
    imageUrl(entry, size) {
      return buildWallpaperUrl(entry.urlbase, size);
    },
  },

  "wikimedia-en": {
    id: "wikimedia-en",
    supportsQuality: false,
    listImages({ count, now }) {
      return listWikimedia("en", count, { now });
    },
    imageUrl(entry) {
      return entry.downloadUrl;
    },
  },

  "wikimedia-zh": {
    id: "wikimedia-zh",
    supportsQuality: false,
    listImages({ count, now }) {
      return listWikimedia("zh", count, { now });
    },
    imageUrl(entry) {
      return entry.downloadUrl;
    },
  },

  wallhaven: {
    id: "wallhaven",
    supportsQuality: false,
    listImages({ now }) {
      return listWallhaven({ now });
    },
    imageUrl(entry) {
      return entry.downloadUrl;
    },
  },

  picsum: {
    id: "picsum",
    supportsQuality: false,
    listImages({ now }) {
      return listPicsum({ now });
    },
    imageUrl(entry) {
      return entry.downloadUrl;
    },
  },
};

export function getSource(id) {
  return SOURCES[id] ?? SOURCES.bing;
}
