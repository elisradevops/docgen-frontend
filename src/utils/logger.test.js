import { describe, expect, test } from 'vitest';
import { createLogger, transports } from './logger.jsx';

// Captures whatever the ConsoleTransport-equivalent would receive, without touching the
// real console — a stand-in "transport" that just records calls.
function makeCapturingLogger(level = 'silly') {
  const calls = [];
  const logger = createLogger({
    level,
    transports: [{ log: (info) => calls.push(info) }],
  });
  return { logger, calls };
}

describe('frontend logger — hostile inputs never throw', () => {
  const cases = [
    ['null', null],
    ['undefined', undefined],
    ['NaN', NaN],
    ['a circular object', (() => { const c = { a: 1 }; c.self = c; return c; })()],
    ['an object with a throwing getter', { get boom() { throw new Error('nope'); } }],
    ['a BigInt', 9007199254740993n],
    ['a Symbol', Symbol('x')],
    ['an Error with no message', new Error()],
    ['a 10MB string', 'x'.repeat(10 * 1024 * 1024)],
  ];

  test.each(cases)('logger.error(%s) does not throw', (_label, value) => {
    const { logger } = makeCapturingLogger();
    expect(() => logger.error(value)).not.toThrow();
  });

  test('logger.error(null) specifically — the confirmed live crash this guards against', () => {
    // Before the fix: `typeof null === 'object'` sent null into the object-message branch,
    // which evaluated `first.message` and threw a TypeError *from inside the logger*, before
    // the pipeline's own try/catch (added alongside this fix) could have caught it.
    const { logger, calls } = makeCapturingLogger();
    expect(() => logger.error(null)).not.toThrow();
    expect(calls).toHaveLength(1);
    expect(calls[0].message).toBe('(null)');
  });

  test('a throwing getter passed as the sole argument does not break the pipeline guard', () => {
    const { logger, calls } = makeCapturingLogger();
    logger.error({ get boom() { throw new Error('nope'); } });
    expect(calls).toHaveLength(1);
  });
});

describe('frontend logger — normal usage still works', () => {
  test('an Error argument surfaces its message', () => {
    const { logger, calls } = makeCapturingLogger();
    logger.error(new Error('boom'));
    expect(calls[0].message).toBe('boom');
  });

  test('a string message plus an object splat arg both come through', () => {
    const { logger, calls } = makeCapturingLogger();
    logger.error('Error Response', { status: 500 });
    expect(calls[0].message).toBe('Error Response');
    expect(calls[0].meta.status).toBe(500);
  });

  test('respects level filtering', () => {
    const { logger, calls } = makeCapturingLogger('warn');
    logger.debug('should be filtered out');
    expect(calls).toHaveLength(0);
  });
});

describe('exported transports (unused today, but part of the public surface)', () => {
  test('ConsoleTransport/MemoryTransport/HttpTransport are exported and constructible', () => {
    expect(() => new transports.ConsoleTransport()).not.toThrow();
    expect(() => new transports.MemoryTransport()).not.toThrow();
    expect(() => new transports.HttpTransport({})).not.toThrow();
  });
});
