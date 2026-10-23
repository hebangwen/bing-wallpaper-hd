const BING_IMAGE_KEY = /OHR\.([A-Za-z0-9]+)/;

// Bing 的 urlbase 带市场后缀（_ZH-CN…/_EN-US…），同一张图在不同语言下不同。
// 去掉后缀后的 OHR 名称才是图片本身，用它做去重键。
export function imageKeyOf(image) {
  if (image?.imageKey) return image.imageKey;

  const urlbase = image?.urlbase ?? "";
  if ((image?.source ?? "bing") === "bing") {
    const match = BING_IMAGE_KEY.exec(urlbase);
    if (match) return `OHR.${match[1]}`;
  }

  return urlbase;
}

function preferred(a, b) {
  const aFavorite = Boolean(a.favorite);
  const bFavorite = Boolean(b.favorite);
  if (aFavorite !== bFavorite) return aFavorite ? a : b;
  return (b.fetchedAt ?? 0) > (a.fetchedAt ?? 0) ? b : a;
}

export function dedupeImages(images) {
  const groups = new Map();

  for (const image of images) {
    const key = `${image.source ?? "bing"}|${imageKeyOf(image)}`;
    const current = groups.get(key);
    groups.set(key, current ? preferred(current, image) : image);
  }

  return [...groups.values()];
}
