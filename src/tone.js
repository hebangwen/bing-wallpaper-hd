// Bing 的 drk=1 表示图片偏暗，此时界面用浅色文字；drk=0 则相反。
export function toneFromDrk(drk) {
  if (drk === 1 || drk === "1" || drk === true) return "dark";
  if (drk === 0 || drk === "0" || drk === false) return "light";
  return null;
}

export function averageLuma(pixels) {
  if (!pixels || pixels.length < 4) return 0;

  let total = 0;
  let count = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    total += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
    count += 1;
  }

  return count === 0 ? 0 : total / count;
}

export const LIGHT_IMAGE_LUMA = 150;

export function toneFromLuma(luma) {
  return luma >= LIGHT_IMAGE_LUMA ? "light" : "dark";
}

// 采样 32px 宽的缩略图求平均亮度，避免整张大图解码。
export async function sampleLuma(blob) {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
    return null;
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob, { resizeWidth: 32, resizeQuality: "low" });
  } catch {
    return null;
  }

  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(bitmap, 0, 0);
    return averageLuma(context.getImageData(0, 0, bitmap.width, bitmap.height).data);
  } catch {
    return null;
  } finally {
    bitmap.close?.();
  }
}

export async function resolveTone({ drk, blob }) {
  const known = toneFromDrk(drk);
  if (known) return known;

  const luma = await sampleLuma(blob);
  return luma === null ? "dark" : toneFromLuma(luma);
}
