import { getPinned, setPinned } from "./pin.js";
import { getAllImages, setFavorite } from "./store.js";

const stateText = {
  downloaded: "壁纸已更新",
  skipped: "壁纸已是最新",
};

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
  button.textContent = favorite ? "★ 已收藏" : "☆ 收藏";
  button.title = favorite ? "取消收藏" : "收藏后不会被自动清理";
}

function renderPin(image) {
  const button = document.getElementById("pin");
  const pinned = Boolean(image) && pinnedUrlbase === image.urlbase;
  button.setAttribute("aria-pressed", String(pinned));
  button.textContent = pinned ? "📌 已固定" : "📌 固定";
  button.title = pinned ? "取消固定，恢复每日壁纸" : "固定为新标签页壁纸";
}

function renderImage(image) {
  const thumbnail = document.getElementById("thumbnail");
  thumbnail.src = objectUrlFor(image);
  thumbnail.hidden = false;
  document.getElementById("title").textContent = image.title || "Bing Wallpaper HD";
  document.getElementById("copyright").textContent = image.copyright ?? "";
  document.getElementById("actions").hidden = false;
  renderFavorite(image);
  renderPin(image);
}

function renderEmpty() {
  document.getElementById("thumbnail").hidden = true;
  document.getElementById("actions").hidden = true;
  document.getElementById("history").replaceChildren();
  document.getElementById("title").textContent = "Bing Wallpaper HD";
  document.getElementById("copyright").textContent = "";
}

function updateSelection(image) {
  for (const button of document.querySelectorAll("#history .history-item")) {
    button.setAttribute("aria-current", String(button.dataset.urlbase === image.urlbase));
  }
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
      thumbnail.alt = image.title || image.date || "历史壁纸";
      button.append(thumbnail);
      return button;
    }),
  );
}

function renderStatus(status, hasImage) {
  const message = document.getElementById("message");

  if (!status) {
    message.textContent = hasImage ? "" : "尚未获取过壁纸，点击下方按钮立即获取。";
    return;
  }

  if (status.state === "error") {
    message.textContent = `获取失败：${status.message ?? "未知错误"}${hasImage ? "，当前显示最近一次壁纸" : ""}`;
  } else if (status.state === "downloaded" && status.changed > 1) {
    message.textContent = `${stateText.downloaded}（${status.changed} 张）`;
  } else {
    message.textContent = stateText[status.state] ?? "";
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
      document.getElementById("message").textContent = "已取消收藏与固定";
    }

    const updated = await setFavorite(selected.urlbase, next);
    if (updated) {
      selected.favorite = updated.favorite;
      const stored = images.find((image) => image.urlbase === updated.urlbase);
      if (stored) stored.favorite = updated.favorite;
      renderFavorite(selected);
    }
  } catch (error) {
    document.getElementById("message").textContent = `收藏失败：${error}`;
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
      document.getElementById("message").textContent = "已取消固定，恢复每日壁纸";
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
      document.getElementById("message").textContent = "已固定为壁纸";
    }

    renderPin(selected);
    renderFavorite(selected);
  } catch (error) {
    document.getElementById("message").textContent = `固定失败：${error}`;
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

  document.getElementById("message").textContent = "已开始下载原图";
});

document.getElementById("fetch").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  let error;
  let fetched = false;

  try {
    const response = await chrome.runtime.sendMessage({ type: "fetch-now" });
    if (!response?.ok) error = response?.error ?? "未知错误";
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
    document.getElementById("message").textContent = `获取失败：${error}`;
  }
});
