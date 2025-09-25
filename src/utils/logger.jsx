import { makeKey, tryLocalStorageGet, tryLocalStorageSet } from './storage.jsx';

// Winston-like logger for the browser
// - Levels: error, warn, info, http, verbose, debug, silly
// - Formats: combine, timestamp, colorize, label, json, printf
// - Transports: Console (default), Memory, Http
// - Supports splat args via Symbol.for('splat') like winston

const NPM_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

const FORMAT_OUTPUT = Symbol('formatOutput');
const SPLAT = Symbol.for('splat');

function coerceError(err) {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack, name: err.name };
  }
  return err;
}

function safeStringify(obj) {
  if (typeof obj === 'object') {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return '[unserializable]';
    }
  }
  return obj;
}

function isLevelEnabled(currentLevel, checkLevel) {
  const cur = NPM_LEVELS[currentLevel] ?? NPM_LEVELS.info;
  const chk = NPM_LEVELS[checkLevel];
  return typeof chk === 'number' && chk <= cur;
}

// ------------------------
// Formats API (similar to winston.format)
// ------------------------
export const format = {
  combine:
    (...fns) =>
    (info) =>
      fns.reduce((acc, fn) => fn(acc), info),

  timestamp:
    (opts = {}) =>
    (info) => ({
      ...info,
      timestamp: typeof opts.format === 'function' ? opts.format(new Date()) : new Date().toISOString(),
    }),

  label:
    ({ label }) =>
    (info) => ({
      ...info,
      label,
    }),

  json: () => (info) => ({ ...info, [FORMAT_OUTPUT]: JSON.stringify(info) }),

  colorize:
    (opts = { level: true, message: false }) =>
    (info) => {
      const colors = {
        error: '\x1b[31m', // red
        warn: '\x1b[33m', // yellow
        info: '\x1b[32m', // green
        http: '\x1b[35m', // magenta
        verbose: '\x1b[36m', // cyan
        debug: '\x1b[34m', // blue
        silly: '\x1b[90m', // gray
      };
      const reset = '\x1b[0m';
      const c = colors[info.level] || '';
      const out = { ...info };
      if (opts.level && c) out.level = `${c}${info.level}${reset}`;
      if (opts.message && c) out.message = `${c}${info.message}${reset}`;
      return out;
    },

  // printf allows full control of the final output string
  printf: (formatter) => (info) => ({ ...info, [FORMAT_OUTPUT]: formatter(info) }),
};

// ------------------------
// Transports
// ------------------------
class BaseTransport {
  constructor(options = {}) {
    this.level = options.level ?? 'silly';
    this.silent = Boolean(options.silent);
    this.format = typeof options.format === 'function' ? options.format : undefined; // formatter chain
  }
  isEnabled(level) {
    return !this.silent && isLevelEnabled(this.level, level);
  }
  close() {}
}

export class ConsoleTransport extends BaseTransport {
  log(info) {
    if (!this.isEnabled(info.level)) return;

    // Apply transport-level format if provided
    const formattedInfo = this.format ? this.format(info) : info;

    const method =
      (console[formattedInfo.level] && formattedInfo.level) || // error, warn, info, debug usually exist
      (formattedInfo.level === 'http' ? 'info' : undefined) ||
      'log';

    const output = formattedInfo[FORMAT_OUTPUT];
    const hasMeta = formattedInfo.meta && Object.keys(formattedInfo.meta).length > 0;

    if (typeof output === 'string') {
      if (hasMeta) console[method](output, formattedInfo.meta);
      else console[method](output);
      return;
    }

    // Fallback formatting if no formatter provided
    const fallback = `${formattedInfo.level}: ${formattedInfo.message}`;
    if (hasMeta) console[method](fallback, formattedInfo.meta);
    else console[method](fallback);
  }
}

export class MemoryTransport extends BaseTransport {
  constructor(options = {}) {
    super(options);
    const size = Number(options.size) || 500;
    this._buffer = new Array(size);
    this._size = size;
    this._idx = 0;
    this._count = 0;
  }
  log(info) {
    if (!this.isEnabled(info.level)) return;
    const entry = {
      ts: Date.now(),
      level: info.level,
      message: info[FORMAT_OUTPUT] || info.message,
      meta: info.meta,
      raw: info,
    };
    this._buffer[this._idx] = entry;
    this._idx = (this._idx + 1) % this._size;
    this._count = Math.min(this._count + 1, this._size);
  }
  entries() {
    const out = [];
    for (let i = 0; i < this._count; i += 1) {
      const idx = (this._idx - this._count + i + this._size) % this._size;
      out.push(this._buffer[idx]);
    }
    return out;
  }
  clear() {
    this._buffer = new Array(this._size);
    this._idx = 0;
    this._count = 0;
  }
}

export class HttpTransport extends BaseTransport {
  constructor(options = {}) {
    super(options);
    this.url = options.url;
    this.headers = options.headers || { 'Content-Type': 'application/json' };
    this.transform = options.transform; // optional: (info) => payload
    if (!this.url) this.silent = true; // disable if not configured
  }
  async log(info) {
    if (!this.isEnabled(info.level)) return;
    if (!this.url || typeof fetch !== 'function') return;
    const payload = this.transform ? this.transform(info) : info;
    try {
      await fetch(this.url, {
        method: 'POST',
        headers: this.headers,
        body: typeof payload === 'string' ? payload : JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      // swallow
    }
  }
}

export const transports = { ConsoleTransport, MemoryTransport, HttpTransport };

// ------------------------
// Logger core
// ------------------------
class Logger {
  constructor({ level, defaultMeta = {}, transports = [], format }) {
    this.level = normalizeLevel(level ?? getInitialLevel());
    this.defaultMeta = defaultMeta;
    this.transports = transports;
    this._format = typeof format === 'function' ? format : undefined;
  }

  log(level, ...args) {
    const lvl = normalizeLevel(level);
    if (!isLevelEnabled(this.level, lvl)) return;

    const { message, meta, splat } = extractMessageAndMeta(args);

    const infoBase = {
      level: lvl,
      message,
      meta: mergeMeta(this.defaultMeta, meta),
      [SPLAT]: splat,
    };

    const info = this._format ? this._format(infoBase) : infoBase;

    for (const t of this.transports) {
      try {
        t.log(info);
      } catch {
        // never throw from logging
      }
    }
  }

  error(...args) {
    this.log('error', ...args);
  }
  warn(...args) {
    this.log('warn', ...args);
  }
  info(...args) {
    this.log('info', ...args);
  }
  http(...args) {
    this.log('http', ...args);
  }
  verbose(...args) {
    this.log('verbose', ...args);
  }
  debug(...args) {
    this.log('debug', ...args);
  }
  silly(...args) {
    this.log('silly', ...args);
  }

  add(transport) {
    this.transports.push(transport);
  }
  remove(transport) {
    const idx = this.transports.indexOf(transport);
    if (idx >= 0) this.transports.splice(idx, 1);
  }
  clear() {
    this.transports.length = 0;
  }
  setLevel(level) {
    this.level = normalizeLevel(level);
  }
  getLevel() {
    return this.level;
  }
}

function mergeMeta(...parts) {
  const out = {};
  for (const p of parts) {
    if (!p) continue;
    if (typeof p !== 'object') continue;
    Object.assign(out, p);
  }
  return out;
}

function extractMessageAndMeta(args) {
  const [first, ...rest] = args;
  let message = first;
  const splat = [];
  const mergeTargets = [];

  if (first instanceof Error) {
    const e = coerceError(first);
    message = e.message;
    mergeTargets.push({ error: e });
  } else if (typeof first === 'object') {
    // If an object is provided as message, move it into meta and set a generic message
    mergeTargets.push(first);
    message = first.message || '(object)';
  }

  // Remaining args are splat; collect them and merge any plain objects into meta
  for (const a of rest) {
    splat.push(a);
    if (a && typeof a === 'object' && !(a instanceof Error)) mergeTargets.push(a);
    if (a instanceof Error) mergeTargets.push({ error: coerceError(a) });
  }

  return { message: String(message), meta: mergeMeta(...mergeTargets), splat };
}

function normalizeLevel(level) {
  if (!level || !NPM_LEVELS[level]) return 'info';
  return level;
}

const LOG_LEVEL_KEY = makeKey('log-level');

function getInitialLevel() {
  const stored = tryLocalStorageGet(LOG_LEVEL_KEY);
  if (stored && NPM_LEVELS[stored]) return stored;
  const mode = (import.meta && import.meta.env && import.meta.env.MODE) || 'production';
  return mode === 'development' ? 'debug' : 'info';
}

export function setGlobalLogLevel(level) {
  const lvl = normalizeLevel(level);
  tryLocalStorageSet(LOG_LEVEL_KEY, lvl);
  defaultLogger.setLevel(lvl);
}

export function getGlobalLogLevel() {
  return defaultLogger.getLevel();
}

export function createLogger(options = {}) {
  return new Logger(options);
}

// ------------------------
// Default logger configured like the sample
// ------------------------
const defaultLogPrintf = format.printf((info) => {
  const message = safeStringify(info.message);
  const meta = info[SPLAT] || [];
  const metaString = meta.map(safeStringify).join(' ');
  return `${info.timestamp} - ${info.level}: ${message} ${metaString}`.trim();
});

export const defaultLogger = new Logger({
  level: getInitialLevel(),
  // global pipeline: timestamp + colorize for level (like sample)
  format: format.combine(format.timestamp(), format.colorize()),
  transports: [
    // transport-specific final printf and its own level like sample
    new ConsoleTransport({ level: 'debug', format: defaultLogPrintf }),
  ],
});

export default defaultLogger;
