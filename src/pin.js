const PIN_KEY = "pinnedUrlbase";

export async function getPinned() {
  const { pinnedUrlbase } = await chrome.storage.local.get(PIN_KEY);
  return typeof pinnedUrlbase === "string" && pinnedUrlbase ? pinnedUrlbase : null;
}

export function setPinned(urlbase) {
  return urlbase
    ? chrome.storage.local.set({ [PIN_KEY]: urlbase })
    : chrome.storage.local.remove(PIN_KEY);
}

// 固定图缺失时回退最新壁纸，避免新标签页空白。
export function pickDisplayImage({ pinnedUrlbase, pinnedImage, latest }) {
  if (pinnedUrlbase && pinnedImage) {
    return { image: pinnedImage, pinned: true };
  }
  return { image: latest ?? null, pinned: false };
}

export function captionFor(image, pinned, prefix = "已固定") {
  const text = [image.title, image.copyright].filter(Boolean).join(" · ");
  if (!pinned) return text;
  return text ? `${prefix} · ${text}` : prefix;
}
