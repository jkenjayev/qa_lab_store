const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** True for errors worth retrying: rate limit, server errors and network failures. */
export function isRetryable(error) {
  const status = error?.status;
  if (status === 429 || (typeof status === 'number' && status >= 500)) return true;
  return ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(error?.code)
    || error?.code === 'notionhq_client_request_timeout';
}

/**
 * Serial write queue for Notion. One call at a time, at least minIntervalMs between calls (Notion allows
 * about 3 requests per second), retry with backoff, and a failed write is recorded but never thrown.
 * A job queued for a key that is still waiting replaces the earlier job (only the latest state is written).
 */
export class WriteQueue {
  #jobs = [];
  #waiting = new Map();
  #running = false;
  #lastCallAt = -Infinity;
  #idleResolvers = [];

  constructor({ minIntervalMs = 350, maxAttempts = 5, backoffBaseMs = 500, sleep = defaultSleep, now = Date.now } = {}) {
    this.minIntervalMs = minIntervalMs;
    this.maxAttempts = maxAttempts;
    this.backoffBaseMs = backoffBaseMs;
    this.sleep = sleep;
    this.now = now;
    this.lastError = null;
    this.lastSyncAt = null;
  }

  get pending() {
    return this.#jobs.length + (this.#running ? 1 : 0);
  }

  /** Queue a task. Resolves (never rejects) when the task finished or was given up. */
  enqueue(key, task) {
    return new Promise((resolve) => {
      const waiting = this.#waiting.get(key);
      if (waiting) {
        waiting.task = task;
        waiting.resolvers.push(resolve);
        return;
      }
      const job = { key, task, resolvers: [resolve] };
      this.#waiting.set(key, job);
      this.#jobs.push(job);
      this.#run();
    });
  }

  /** Resolves when the queue is empty. */
  idle() {
    if (!this.pending) return Promise.resolve();
    return new Promise((resolve) => this.#idleResolvers.push(resolve));
  }

  status() {
    return { pending: this.pending, lastError: this.lastError, lastSyncAt: this.lastSyncAt };
  }

  async #run() {
    if (this.#running) return;
    this.#running = true;
    while (this.#jobs.length) {
      const job = this.#jobs.shift();
      this.#waiting.delete(job.key);
      await this.#execute(job);
      for (const resolve of job.resolvers) resolve();
    }
    this.#running = false;
    for (const resolve of this.#idleResolvers.splice(0)) resolve();
  }

  async #execute(job) {
    for (let attempt = 1; ; attempt += 1) {
      const wait = this.#lastCallAt + this.minIntervalMs - this.now();
      if (wait > 0) await this.sleep(wait);
      this.#lastCallAt = this.now();
      try {
        await job.task();
        this.lastSyncAt = new Date(this.now()).toISOString();
        return;
      } catch (error) {
        if (isRetryable(error) && attempt < this.maxAttempts) {
          await this.sleep(error.retryAfterMs ?? this.backoffBaseMs * 2 ** (attempt - 1));
          continue;
        }
        this.lastError = { key: job.key, message: String(error?.message ?? error), attempts: attempt, at: new Date(this.now()).toISOString() };
        return;
      }
    }
  }
}
