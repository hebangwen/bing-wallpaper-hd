import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetry } from "../src/network.js";

test("returns the first successful response", async () => {
  let calls = 0;
  const response = await fetchWithRetry("https://example.com", {
    fetchImpl: async () => {
      calls += 1;
      return new Response("ok");
    },
    retryDelaysMs: [0, 0],
  });

  assert.equal(calls, 1);
  assert.equal(await response.text(), "ok");
});

test("retries a retryable response and returns the next success", async () => {
  let calls = 0;
  const response = await fetchWithRetry("https://example.com", {
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? new Response("", { status: 503 }) : new Response("ok");
    },
    retryDelaysMs: [0],
  });

  assert.equal(calls, 2);
  assert.equal(await response.text(), "ok");
});

test("does not retry a non-retryable response", async () => {
  let calls = 0;

  await assert.rejects(
    fetchWithRetry("https://example.com", {
      fetchImpl: async () => {
        calls += 1;
        return new Response("", { status: 404 });
      },
      retryDelaysMs: [0, 0],
    }),
    /HTTP 404/,
  );

  assert.equal(calls, 1);
});

test("retries network errors up to the configured attempt count", async () => {
  let calls = 0;

  await assert.rejects(
    fetchWithRetry("https://example.com", {
      fetchImpl: async () => {
        calls += 1;
        throw new TypeError("offline");
      },
      retryDelaysMs: [0, 0],
    }),
    /offline/,
  );

  assert.equal(calls, 3);
});
