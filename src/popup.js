import { getAllImages } from "./store.js";

const stateText = {
  downloaded: "已下载今日壁纸",
  skipped: "今日壁纸已在本地，无需重复下载",
};

const objectUrls = new Map();
let images = [];
let selectedUrlbase;

function objectUrlFor(image) {
  let url = objectUrls.get(image.urlbase);
  if (!url) {
    url = URL.createObjectURL(image.blob);
    objectUrls.set(image.urlbase, url);
  }
  return url;
}

function newestFirst(a, b) {
  return (b.date ?? "").localeCompare(a.date ?? "") || b.fetchedAt - a.fetchedAt;
}

function renderImage(image) {
  const thumbnail = document.getElementById("thumbnail");
  thumbnail.src = objectUrlFor(image);
  thumbnail.hidden = false;
  document.getElementById("title").textContent = image.title || "Bing Wallpaper HD";
  document.getElementById("copyright").textContent = image.copyright ?? "";
}

function renderEmpty() {
  document.getElementById("thumbnail").hidden = true;
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
  selectedUrlbase = image.urlbase;
  renderImage(image);
  updateSelection(image);
}

function renderHistory(selected) {
  const container = document.getElementById("history");
  container.replaceChildren(
    ...images.map((image) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      button.dataset.urlbase = image.urlbase;
      button.title = [image.date, image.title].filter(Boolean).join(" ");
      button.setAttribute("aria-current", String(image.urlbase === selected.urlbase));
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
  const selected = images.find((image) => image.urlbase === selectedUrlbase) ?? latest;
  selectedUrlbase = selected?.urlbase;

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

  if (fetched) selectedUrlbase = undefined;

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
