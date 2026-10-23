export const THUMB_MAX_WIDTH = 640;

export function thumbnailSize(width, height, maxWidth = THUMB_MAX_WIDTH) {
  if (!(width > 0) || !(height > 0) || !(maxWidth > 0)) {
    return { width: 0, height: 0 };
  }
  if (width <= maxWidth) return { width: Math.round(width), height: Math.round(height) };

  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.max(1, Math.round(height * scale)) };
}

// 在 service worker 中生成轻量缩略图；环境不支持时返回 null，界面回退到原图。
export async function makeThumbnail(blob, { maxWidth = THUMB_MAX_WIDTH, quality = 0.82 } = {}) {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
    return null;
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  try {
    const { width, height } = thumbnailSize(bitmap.width, bitmap.height, maxWidth);
    if (width === 0 || height === 0) return null;

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(bitmap, 0, 0, width, height);

    try {
      return await canvas.convertToBlob({ type: "image/webp", quality });
    } catch {
      return await canvas.convertToBlob({ type: "image/jpeg", quality });
    }
  } catch {
    return null;
  } finally {
    bitmap.close?.();
  }
}
