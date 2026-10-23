import test from "node:test";
import assert from "node:assert/strict";
import { formatDateLine, formatTime } from "../src/clock.js";

const at = (hour, minute, second) => new Date(2026, 9, 23, hour, minute, second);

test("formats 24-hour time with seconds", () => {
  assert.equal(formatTime(at(21, 5, 9)), "21:05:09");
  assert.equal(formatTime(at(9, 5, 9), { showSeconds: false }), "09:05");
  assert.equal(formatTime(at(0, 0, 0)), "00:00:00");
});

test("formats 12-hour time with a period", () => {
  assert.equal(formatTime(at(9, 5, 7), { hour24: false }), "上午 9:05:07");
  assert.equal(formatTime(at(21, 5, 7), { hour24: false }), "下午 9:05:07");
  assert.equal(formatTime(at(0, 0, 0), { hour24: false }), "上午 12:00:00");
  assert.equal(formatTime(at(12, 0, 0), { hour24: false }), "下午 12:00:00");
  assert.equal(formatTime(at(21, 5, 7), { hour24: false, showSeconds: false }), "下午 9:05");
});

test("formats the date line", () => {
  const date = at(21, 5, 9);
  assert.equal(formatDateLine(date, "long"), "2026年10月23日 星期五");
  assert.equal(formatDateLine(date, "numeric"), "2026-10-23");
  assert.equal(formatDateLine(date, "hidden"), "");
  assert.equal(formatDateLine(date), "2026年10月23日 星期五");
});
