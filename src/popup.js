import { applyI18n, initI18n, t } from "./i18n.js";
import { getPinned, setPinned } from "./pin.js";
import { loadSettings } from "./settings.js";
import { getAllImages, setFavorite } from "./store.js";

await initI18n((await loadSettings()).language);
applyI18n();

const objectUrls = new Map();
let images = [];
let selected = null;
let pinnedUrlbase = null;

function objectUrlFor(image) {
  let url = objectUrls.get(image.urlbase);
  if (!url) {
    url = URL.createObjectURL(image.thumb ?? image.blob);
    objectUrls.set(image.urlbase, url);
  }
  return url;
}

function newestFirst(a, b) {
  return (b.date ?? "").localeCompare(a.date ?? "") || b.fetchedAt - a.fetchedAt;
}

function downloadName(image) {
  const ext = image.blob?.type === "image/png" ? "png" : "jpg";
  const title = (image.title || "wallpaper")
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `bing-${image.date || "unknown"}-${title}.${ext}`;
}

function renderFavorite(image) {
  const button = document.getElementById("favorite");
  const favorite = Boolean(image?.favorite);
  button.setAttribute("aria-pressed", String(favorite));
  button.textContent = favorite ? t("favorited") : t("favorite");
  button.title = favorite ? t("favoritedTitle") : t("favoriteTitle");
}

function renderPin(image) {
  const button = document.getElementById("pin");
  const pinned = Boolean(image) && pinnedUrlbase === image.urlbase;
  button.setAttribute("aria-pressed", String(pinned));
  button.textContent = pinned ? t("pinned") : t("pin");
  button.title = pinned ? t("pinnedTitle") : t("pinTitle");
}

function renderImage(image) {
  const thumbnail = document.getElementById("thumbnail");
  thumbnail.src = objectUrlFor(image);
  thumbnail.hidden = false;
  document.getElementById("title").textContent = image.title || t("appName");
  document.getElementById("copyright").textContent = image.copyright ?? "";
  document.getElementById("actions").hidden = false;
  renderFavorite(image);
  renderPin(image);
}

function renderEmpty() {
  document.getElementById("thumbnail").hidden = true;
  document.getElementById("actions").hidden = true;
  document.getElementById("history").replaceChildren();
  document.getElementById("title").textContent = t("appName");
  document.getElementById("copyright").textContent = "";
}

function scrollActiveIntoView() {
  const container = document.getElementById("history");
  container.querySelector('[aria-current="true"]')?.scrollIntoView({
    block: "nearest",
    inline: "center",
  });
}

function updateSelection(image) {
  for (const button of document.querySelectorAll("#history .history-item")) {
    button.setAttribute("aria-current", String(button.dataset.urlbase === image.urlbase));
  }
  scrollActiveIntoView();
}

function selectImage(image) {
  selected = image;
  renderImage(image);
  updateSelection(image);
}

function renderHistory(current) {
  const container = document.getElementById("history");
  container.replaceChildren(
    ...images.map((image) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      button.dataset.urlbase = image.urlbase;
      button.title = [image.date, image.title].filter(Boolean).join(" ");
      button.setAttribute("aria-current", String(image.urlbase === current.urlbase));
      button.addEventListener("click", () => selectImage(image));

      const thumbnail = document.createElement("img");
      thumbnail.src = objectUrlFor(image);
      thumbnail.alt = image.title || image.date || t("historyAlt");
      button.append(thumbnail);
      return button;
    }),
  );

  scrollActiveIntoView();
}

function renderStatus(status, hasImage) {
  const message = document.getElementById("message");

  if (!status) {
    message.textContent = hasImage ? "" : t("emptyHint");
    return;
  }

  if (status.state === "error") {
    const error = status.message ?? t("unknownError");
    message.textContent = t("statusError", [error]) + (hasImage ? t("statusErrorSuffix") : "");
  } else if (status.state === "downloaded" && status.changed > 1) {
    message.textContent = t("statusDownloadedMany", [status.changed]);
  } else if (status.state === "downloaded") {
    message.textContent = t("statusDownloaded");
  } else if (status.state === "skipped") {
    message.textContent = t("statusSkipped");
  } else {
    message.textContent = "";
  }

  if (status.updatedAt) {
    document.getElementById("details").hidden = false;
    document.getElementById("updated").textContent = new Date(status.updatedAt).toLocaleString();
  }
}

async function refresh() {
  const [{ status }, allImages, pinned] = await Promise.all([
    chrome.storage.local.get("status"),
    getAllImages(),
    getPinned(),
  ]);

  pinnedUrlbase = pinned;
  images = [...allImages].sort(newestFirst);

  const latest = images[0] ?? null;
  const pinnedImage = pinned ? images.find((image) => image.urlbase === pinned) : null;
  selected =
    images.find((image) => image.urlbase === selected?.urlbase) ?? pinnedImage ?? latest;

  renderStatus(status, Boolean(latest));
  if (!selected) {
    renderEmpty();
    return;
  }

  renderImage(selected);
  renderHistory(selected);
}

addEventListener("pagehide", () => {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
});

await refresh();

const historyStrip = document.getElementById("history");

// 鼠标滚轮竖向滚动时横向移动缩略图条；触控板的横向滑动交给浏览器。
historyStrip.addEventListener(
  "wheel",
  (event) => {
    if (event.deltaX !== 0) return;
    if (historyStrip.scrollWidth <= historyStrip.clientWidth) return;

    event.preventDefault();
    const scale =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? historyStrip.clientWidth : 1;
    historyStrip.scrollLeft += event.deltaY * scale;
  },
  { passive: false },
);

document.getElementById("favorite").addEventListener("click", async (event) => {
  if (!selected) return;

  const button = event.currentTarget;
  button.disabled = true;
  try {
    const next = !selected.favorite;
    // 取消收藏会同时解除固定，避免固定图被保留期清理。
    if (!next && pinnedUrlbase === selected.urlbase) {
      await setPinned(null);
      pinnedUrlbase = null;
      renderPin(selected);
      document.getElementById("message").textContent = t("favoriteRemoved");
    }

    const updated = await setFavorite(selected.urlbase, next);
    if (updated) {
      selected.favorite = updated.favorite;
      const stored = images.find((image) => image.urlbase === updated.urlbase);
      if (stored) stored.favorite = updated.favorite;
      renderFavorite(selected);
    }
  } catch (error) {
    document.getElementById("message").textContent = t("favoriteFailed", [error]);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("pin").addEventListener("click", async (event) => {
  if (!selected) return;

  const button = event.currentTarget;
  button.disabled = true;
  try {
    if (pinnedUrlbase === selected.urlbase) {
      await setPinned(null);
      pinnedUrlbase = null;
      document.getElementById("message").textContent = t("pinCleared");
    } else {
      await setPinned(selected.urlbase);
      pinnedUrlbase = selected.urlbase;

      // 固定图必须同时收藏，才能免于保留期清理和配额淘汰。
      const updated = await setFavorite(selected.urlbase, true);
      if (updated) {
        selected.favorite = updated.favorite;
        const stored = images.find((image) => image.urlbase === updated.urlbase);
        if (stored) stored.favorite = updated.favorite;
      }
      document.getElementById("message").textContent = t("pinSet");
    }

    renderPin(selected);
    renderFavorite(selected);
  } catch (error) {
    document.getElementById("message").textContent = t("pinFailed", [error]);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("save").addEventListener("click", () => {
  if (!selected?.blob) return;

  const url = URL.createObjectURL(selected.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = downloadName(selected);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  document.getElementById("message").textContent = t("downloadStarted");
});

document.getElementById("fetch").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  let error;
  let fetched = false;

  try {
    const response = await chrome.runtime.sendMessage({ type: "fetch-now" });
    if (!response?.ok) error = response?.error ?? t("unknownError");
    else fetched = true;
  } catch (sendError) {
    error = String(sendError);
  }

  if (fetched) selected = null;

  try {
    await refresh();
  } catch (refreshError) {
    error ??= String(refreshError);
  }

  button.disabled = false;

  if (error) {
    document.getElementById("message").textContent = t("statusError", [error]);
  }
});
