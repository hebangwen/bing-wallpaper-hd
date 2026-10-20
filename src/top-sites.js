export const TOP_SITE_LIMIT = 10;

export function topSitesFrom(rawSites, limit = TOP_SITE_LIMIT) {
  const seen = new Set();
  const sites = [];

  for (const raw of rawSites) {
    if (sites.length >= limit) break;

    let url;
    try {
      url = new URL(raw.url);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;

    const host = url.hostname.replace(/^www\./, "");
    if (seen.has(host)) continue;
    seen.add(host);

    sites.push({
      url: raw.url,
      host,
      name: raw.title?.trim() || host,
    });
  }

  return sites;
}
