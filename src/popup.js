import { getAllImages } from "./store.js";

const stateText = {
  downloaded: "已下载今日壁纸",
  skipped: "今日壁纸已在本地，无需重复下载",
  error: "获取失败",
};

function renderHistory(images, currentUrlbase) {
  const container = document.getElementById("history");
  container.replaceChildren();
  for (const image of images) {
    if (image.urlbase === currentUrlbase) continue;
    const thumbnail = document.createElement("img");
    thumbnail.src = URL.createObjectURL(image.blob);
    thumbnail.title = `${image.date} ${image.title}`;
    container.append(thumbnail);
  }
}

function render(status) {
  const message = document.getElementById("message");
  if (!status) {
    message.textContent = "尚未获取过壁纸，点击下方按钮立即获取。";
    return;
  }
  message.textContent = status.state === "error" ? `获取失败：${status.message}` : stateText[status.state];
  if (status.image) {
    document.getElementById("title").textContent = status.image.title;
    document.getElementById("copyright").textContent = status.image.copyright;
  }
  if (status.size && status.device) {
    document.getElementById("details").hidden = false;
    document.getElementById("size").textContent = `${status.size.width} × ${status.size.height}`;
    document.getElementById("device").textContent = `${status.device.width} × ${status.device.height}`;
    document.getElementById("updated").textContent = new Date(status.updatedAt).toLocaleString();
  }
}

const { status } = await chrome.storage.local.get("status");
render(status);

const images = (await getAllImages()).sort((a, b) => b.fetchedAt - a.fetchedAt);
if (images.length > 0) {
  const latest = images[0];
  const thumbnail = document.getElementById("thumbnail");
  thumbnail.src = URL.createObjectURL(latest.blob);
  thumbnail.hidden = false;
  renderHistory(images, latest.urlbase);
}

document.getElementById("fetch").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  const response = await chrome.runtime.sendMessage({ type: "fetch-now" });
  const { status: updated } = await chrome.storage.local.get("status");
  render(updated);
  button.disabled = false;
  if (!response?.ok && !updated) {
    document.getElementById("message").textContent = `获取失败：${response?.error ?? "未知错误"}`;
  }
});
