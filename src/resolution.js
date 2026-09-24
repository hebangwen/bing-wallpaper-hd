export const IMAGE_SIZES = [
  { width: 3840, height: 2160, suffix: "UHD" },
  { width: 1920, height: 1200, suffix: "1920x1200" },
  { width: 1920, height: 1080, suffix: "1920x1080" },
  { width: 1366, height: 768, suffix: "1366x768" },
  { width: 1280, height: 768, suffix: "1280x768" },
  { width: 1024, height: 768, suffix: "1024x768" },
  { width: 800, height: 600, suffix: "800x600" },
  { width: 640, height: 480, suffix: "640x480" },
];

export function pickImageSize(deviceWidth, deviceHeight) {
  const covering = IMAGE_SIZES.filter((s) => s.width >= deviceWidth && s.height >= deviceHeight);
  const candidates = covering.length > 0 ? covering : [IMAGE_SIZES[0]];
  return candidates.reduce((best, s) => (s.width * s.height < best.width * best.height ? s : best));
}

export function buildImageUrl(urlbase, size) {
  return `https://www.bing.com${urlbase}_${size.suffix}.jpg`;
}
