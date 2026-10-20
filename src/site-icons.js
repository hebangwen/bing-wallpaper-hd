const SITE_ICON_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_RASTER_ICON_PIXELS = 40;
const MAX_HTML_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 4000;
const ICON_TIMEOUT_MS = 5000;
const VECTOR_SCORE = 1_000_000;
const MAX_SITE_ICONS = 100;
const ICON_REL = /(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon)(\s|$)/i;

function iconSize(sizes) {
  const values = sizes
    .toLowerCase()
    .split(/\s+/)
    .map((value) => Number.parseInt(value, 10) || 0);
  return Math.max(0, ...values);
}

function isVectorIcon(candidate) {
  const sizes = (candidate.sizes ?? "").toLowerCase();
  return (
    (candidate.type ?? "").toLowerCase().includes("svg") ||
    sizes.split(/\s+/).includes("any") ||
    /\.svg(?:[?#]|$)/i.test(candidate.href)
  );
}

function iconScore(candidate) {
  const rel = (candidate.rel ?? "").toLowerCase();
  if (isVectorIcon(candidate)) {
    if (rel.includes("mask-icon")) return VECTOR_SCORE;
    if (rel.includes("apple-touch-icon")) return VECTOR_SCORE + 1;
    return VECTOR_SCORE + 2;
  }

  const size = iconSize(candidate.sizes ?? "");
  if (size > 0) return size;

  if (rel.includes("apple-touch-icon")) return 180;
  if (rel.includes("mask-icon")) return 16;
  return 32;
}

export function rankSiteIcons(candidates) {
  return [...candidates].sort((a, b) => iconScore(b) - iconScore(a));
}

export function pruneSiteIcons(
  siteIcons,
  { now = Date.now(), ttlMs = SITE_ICON_TTL_MS, limit = MAX_SITE_ICONS } = {},
) {
  return Object.fromEntries(
    Object.entries(siteIcons ?? {})
      .filter(([, icon]) => Number.isFinite(icon?.checkedAt) && now - icon.checkedAt < ttlMs)
      .sort(([, a], [, b]) => b.checkedAt - a.checkedAt)
      .slice(0, limit),
  );
}

async function readHead(response) {
  if (!response.body) {
    return (await response.text()).slice(0, MAX_HTML_BYTES);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;

  try {
    while (bytes < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  return html + decoder.decode();
}

async function discoverSiteIcons(pageUrl) {
  let response;
  try {
    response = await fetch(pageUrl, {
      credentials: "include",
      redirect: "follow",
      headers: { accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/html/i.test(contentType)) return [];

  let html;
  try {
    html = await readHead(response);
  } catch {
    return [];
  }
  if (!html) return [];

  const page = new DOMParser().parseFromString(html, "text/html");
  const baseUrl = response.url || pageUrl;
  const candidates = [];

  for (const link of page.querySelectorAll("link[rel]")) {
    const rel = link.getAttribute("rel") ?? "";
    const href = link.getAttribute("href");
    if (!href || !ICON_REL.test(rel)) continue;

    let url;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (!["http:", "https:", "data:"].includes(url.protocol)) continue;

    candidates.push({
      href: url.href,
      rel,
      sizes: link.getAttribute("sizes") ?? "",
      type: link.getAttribute("type") ?? "",
    });
  }

  return rankSiteIcons(candidates);
}

function imageLoads(href, vector) {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => resolve(false), ICON_TIMEOUT_MS);

    image.onload = () => {
      clearTimeout(timer);
      resolve(vector || image.naturalWidth >= MIN_RASTER_ICON_PIXELS);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    image.src = href;
  });
}

async function firstUsableIcon(candidates) {
  for (const candidate of candidates) {
    const vector = isVectorIcon(candidate);
    const size = iconSize(candidate.sizes ?? "");
    if (!vector && size > 0 && size < MIN_RASTER_ICON_PIXELS) continue;
    if (await imageLoads(candidate.href, vector)) {
      return { url: candidate.href, vector };
    }
  }
  return null;
}

export async function resolveSiteIcons(sites, onResolved) {
  const { siteIcons = {} } = await chrome.storage.local.get("siteIcons");
  const cachedIcons = siteIcons ?? {};
  const now = Date.now();
  const updates = {};

  await Promise.all(
    sites.map(async (site) => {
      const cached = cachedIcons[site.host];
      if (cached && now - cached.checkedAt < SITE_ICON_TTL_MS) {
        if (cached.url && (await imageLoads(cached.url, cached.vector))) {
          onResolved(site, cached.url);
        }
        return;
      }

      const icon = await firstUsableIcon(await discoverSiteIcons(site.url));
      updates[site.host] = {
        url: icon?.url ?? null,
        vector: icon?.vector ?? false,
        checkedAt: now,
      };
      if (icon) onResolved(site, icon.url);
    }),
  );

  const { siteIcons: latest = {} } = await chrome.storage.local.get("siteIcons");
  const merged = { ...(latest ?? {}), ...updates };
  const pruned = pruneSiteIcons(merged, { now });
  const changed =
    Object.keys(updates).length > 0 ||
    Object.keys(pruned).length !== Object.keys(merged).length;

  if (changed) {
    await chrome.storage.local.set({ siteIcons: pruned });
  }
}
