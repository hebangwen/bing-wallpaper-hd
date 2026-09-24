const API_URL = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN";

export async function fetchDailyImage() {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Bing API returned ${response.status}`);
  }
  const data = await response.json();
  const image = data.images[0];
  return {
    urlbase: image.urlbase,
    title: image.title,
    copyright: image.copyright,
    date: image.startdate,
  };
}
