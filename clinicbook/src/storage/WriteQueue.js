const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRY_CODES = new Set(['rate_limited', 'service_unavailable', 'internal_server_error', 'gateway_timeout', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']);

/** True for errors worth retrying: HTTP 429, 5xx and common network failures. */
export function isRetryable(error) {
  const status = error?.status;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  return RETRY_CODES.has(error?.code);
}

/** Milliseconds to wait before the next try: Retry-After when present, else exponential backoff. */
export function retryDelay(error, attempt, baseDelayMs) {
  const header = error?.headers?.['retry-after'] ?? error?.headers?.get?.('retry-after');
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return baseDelayMs * 2 ** (attempt - 1);
}

/**
 * Runs Notion calls strictly one at a time with a minimum gap (Notion allows about 3 requests per
 * second), retrying transient failures. A failed job rejects its own promise and is recorded in
 * lastError, but never stops the queue.
 */
export class WriteQueue {
  #chain = Promise.resolve();
  #pending = 0;
  #lastCall = -Infinity;

  constructor({ minIntervalMs = 350, maxAttempts = 5, baseDelayMs = 500, sleep = defaultSleep, now = () => Date.now() } = {}) {
    Object.assign(this, { minIntervalMs, maxAttempts, baseDelayMs, sleep, now });
    this.lastError = null;
    this.lastSyncAt = null;
  }

  get pending() {
    return this.#pending;
  }

  enqueue(label, task) {
    this.#pending += 1;
    const run = async () => {
      try {
        for (let attempt = 1; ; attempt += 1) {
          const wait = this.minIntervalMs - (this.now() - this.#lastCall);
          if (wait > 0) await this.sleep(wait);
          this.#lastCall = this.now();
          try {
            const result = await task();
            this.lastSyncAt = new Date(this.now()).toISOString();
            return result;
          } catch (error) {
            if (attempt >= this.maxAttempts || !isRetryable(error)) throw error;
            await this.sleep(retryDelay(error, attempt, this.baseDelayMs));
          }
        }
      } catch (error) {
        this.lastError = { label, message: String(error?.message ?? error), at: new Date(this.now()).toISOString() };
        throw error;
      } finally {
        this.#pending -= 1;
      }
    };
    const result = this.#chain.then(run, run);
    this.#chain = result.catch(() => {});
    return result;
  }

  /** Resolves when every job queued so far is finished (successfully or not). */
  idle() {
    return this.#chain;
  }
}
