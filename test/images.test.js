import test from "node:test";
import assert from "node:assert/strict";
import { dedupeImages, imageKeyOf } from "../src/images.js";

const bing = (urlbase, date, fetchedAt, extra = {}) => ({
  urlbase,
  source: "bing",
  date,
  fetchedAt,
  ...extra,
});

test("derives a market-independent key for Bing images", () => {
  assert.equal(
    imageKeyOf({ urlbase: "/th?id=OHR.YellowstoneWolves_ZH-CN6767268961" }),
    "OHR.YellowstoneWolves",
  );
  assert.equal(
    imageKeyOf({ urlbase: "/th?id=OHR.YellowstoneWolves_EN-US7105521535" }),
    "OHR.YellowstoneWolves",
  );
  assert.equal(
    imageKeyOf({ urlbase: "/th?id=OHR.TsutanumaMomiji2026_JA-JP1409614988" }),
    "OHR.TsutanumaMomiji2026",
  );
});

test("keeps non-Bing urls as their own key", () => {
  const url = "https://upload.wikimedia.org/example.jpg";
  assert.equal(imageKeyOf({ urlbase: url, source: "wikimedia-en" }), url);
  assert.equal(imageKeyOf({ urlbase: "/plain", imageKey: "given" }), "given");
});

test("collapses the same image across markets", () => {
  const images = [
    bing("/th?id=OHR.Wolves_ZH-CN1", "20261022", 10),
    bing("/th?id=OHR.Wolves_EN-US2", "20261023", 20),
    bing("/th?id=OHR.Sloth_ZH-CN3", "20261021", 5),
  ];

  assert.deepEqual(
    dedupeImages(images).map((image) => image.urlbase),
    ["/th?id=OHR.Wolves_EN-US2", "/th?id=OHR.Sloth_ZH-CN3"],
  );
});

test("prefers favorites and then the newest entry", () => {
  const favorite = bing("/th?id=OHR.Wolves_ZH-CN1", "20261022", 10, { favorite: true });
  const newer = bing("/th?id=OHR.Wolves_EN-US2", "20261023", 20);

  assert.equal(dedupeImages([newer, favorite])[0], favorite);
  assert.equal(dedupeImages([favorite, newer])[0], favorite);
});

test("keeps images from different sources apart", () => {
  const images = [
    { urlbase: "https://a/1.jpg", source: "wikimedia-en", date: "20261022", fetchedAt: 1 },
    { urlbase: "https://a/2.jpg", source: "wikimedia-zh", date: "20261022", fetchedAt: 2 },
  ];

  assert.equal(dedupeImages(images).length, 2);
});
