import { getAllImages, setFavorite } from "./store.js";

const stateText = {
  downloaded: "壁纸已更新",
  skipped: "壁纸已是最新",
};

const objectUrls = new Map();
let images = [];
let selected = null;

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

function renderImage(image) {
  const thumbnail = document.getElementById("thumbnail");
  thumbnail.src = objectUrlFor(image);
  thumbnail.hidden = false;
  document.getElementById("title").textContent = image.title || "Bing Wallpaper HD";
  document.getElementById("copyright").textContent = image.copyright ?? "";
  document.getElementById("actions").hidden = false;
  renderFavorite(image);
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
  const [{ status }, allImages] = await Promise.all([
    chrome.storage.local.get("status"),
    getAllImages(),
  ]);

  images = [...allImages].sort(newestFirst);
  const latest = images[0] ?? null;
  selected = images.find((image) => image.urlbase === selected?.urlbase) ?? latest;

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
    const updated = await setFavorite(selected.urlbase, !selected.favorite);
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
