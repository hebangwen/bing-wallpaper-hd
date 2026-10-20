const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000];
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url,
  {
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    ...init
  } = {},
) {
  let lastError;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    let response;

    try {
      response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = error;
    }

    if (response) {
      if (response.ok) return response;

      lastError = new Error(`HTTP ${response.status}`);
      if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
    }

    if (attempt < retryDelaysMs.length) {
      await sleep(retryDelaysMs[attempt]);
    }
  }

  throw lastError;
}
