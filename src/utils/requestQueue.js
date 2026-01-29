const DEFAULT_MAX_CONCURRENT = 6;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 400;

const queues = new Map();
const PRIORITIES = ['high', 'normal', 'low'];
const retryStatusCodes = new Set([429, 502, 503, 504]);
const retryErrorCodes = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK', 'ERR_FAILED']);
let globalMaxConcurrent = null;
let globalActiveCount = 0;

const getStatus = (err) => err?.status || err?.response?.status;

const shouldRetry = (err) => {
  const status = getStatus(err);
  if (status && retryStatusCodes.has(status)) return true;
  const code = err?.code;
  if (code && retryErrorCodes.has(code)) return true;
  const message = String(err?.message || '');
  return /timeout|ECONNABORTED|ETIMEDOUT|Network\s?Error|Failed to fetch|ERR_FAILED|ERR_NETWORK|CORS/i.test(
    message
  );
};

const nextDelay = (baseDelayMs, attempt) => {
  const base = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.floor(base * 0.2 * Math.random());
  return base + jitter;
};

const getQueue = (key = 'default') => {
  if (!queues.has(key)) {
    queues.set(key, {
      key,
      items: {
        high: [],
        normal: [],
        low: [],
      },
      activeCount: 0,
      maxConcurrent: DEFAULT_MAX_CONCURRENT,
      maxRetries: DEFAULT_MAX_RETRIES,
      baseDelayMs: DEFAULT_BASE_DELAY_MS,
    });
  }
  return queues.get(key);
};

const canRun = (queue) => {
  if (queue.activeCount >= queue.maxConcurrent) return false;
  if (typeof globalMaxConcurrent === 'number' && globalMaxConcurrent > 0) {
    return globalActiveCount < globalMaxConcurrent;
  }
  return true;
};

const runNext = (queue) => {
  if (!canRun(queue)) return;
  const job =
    queue.items.high.shift() || queue.items.normal.shift() || queue.items.low.shift();
  if (!job) return;
  queue.activeCount += 1;
  if (typeof globalMaxConcurrent === 'number' && globalMaxConcurrent > 0) {
    globalActiveCount += 1;
  }
  Promise.resolve()
    .then(job.fn)
    .then((result) => {
      queue.activeCount -= 1;
      if (typeof globalMaxConcurrent === 'number' && globalMaxConcurrent > 0) {
        globalActiveCount -= 1;
      }
      job.resolve(result);
      runNext(queue);
      if (typeof globalMaxConcurrent === 'number' && globalMaxConcurrent > 0) {
        queues.forEach((q) => runNext(q));
      }
    })
    .catch((err) => {
      queue.activeCount -= 1;
      if (typeof globalMaxConcurrent === 'number' && globalMaxConcurrent > 0) {
        globalActiveCount -= 1;
      }
      const attempt = job.attempt || 0;
      if (attempt < queue.maxRetries && shouldRetry(err)) {
        const delay = nextDelay(queue.baseDelayMs, attempt);
        setTimeout(() => {
          const priority = PRIORITIES.includes(job.priority) ? job.priority : 'normal';
          queue.items[priority].unshift({ ...job, attempt: attempt + 1 });
          runNext(queue);
          if (typeof globalMaxConcurrent === 'number' && globalMaxConcurrent > 0) {
            queues.forEach((q) => runNext(q));
          }
        }, delay);
        return;
      }
      job.reject(err);
      runNext(queue);
      if (typeof globalMaxConcurrent === 'number' && globalMaxConcurrent > 0) {
        queues.forEach((q) => runNext(q));
      }
    });
};

export const enqueueRequest = (fn, options = {}) =>
  new Promise((resolve, reject) => {
    const key = options?.key || 'default';
    const priority = PRIORITIES.includes(options?.priority) ? options.priority : 'normal';
    const queue = getQueue(key);
    queue.items[priority].push({ fn, resolve, reject, attempt: 0, priority });
    runNext(queue);
  });

export const setRequestQueueConfig = (config = {}) => {
  if (Object.prototype.hasOwnProperty.call(config, 'globalMaxConcurrent')) {
    const value = config.globalMaxConcurrent;
    globalMaxConcurrent =
      typeof value === 'number' && value > 0 ? Math.floor(value) : null;
  } else if (config.global && typeof config.global === 'object') {
    const value = config.global.maxConcurrent;
    globalMaxConcurrent =
      typeof value === 'number' && value > 0 ? Math.floor(value) : null;
  }

  const applyConfig = (queue, cfg) => {
    if (typeof cfg.maxConcurrent === 'number' && cfg.maxConcurrent > 0) {
      queue.maxConcurrent = Math.max(1, Math.floor(cfg.maxConcurrent));
    }
    if (typeof cfg.maxRetries === 'number' && cfg.maxRetries >= 0) {
      queue.maxRetries = Math.floor(cfg.maxRetries);
    }
    if (typeof cfg.baseDelayMs === 'number' && cfg.baseDelayMs >= 0) {
      queue.baseDelayMs = Math.floor(cfg.baseDelayMs);
    }
    runNext(queue);
  };

  if (config.queues && typeof config.queues === 'object') {
    Object.entries(config.queues).forEach(([key, cfg]) => {
      applyConfig(getQueue(key), cfg || {});
    });
    queues.forEach((q) => runNext(q));
    return;
  }
  const key = config.key || 'default';
  applyConfig(getQueue(key), config);
};
