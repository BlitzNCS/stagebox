const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const createLogger = require('../lib/logger');

describe('Logger', () => {
  it('creates a logger with all four methods', () => {
    const log = createLogger('test');
    assert.equal(typeof log.error, 'function');
    assert.equal(typeof log.warn, 'function');
    assert.equal(typeof log.info, 'function');
    assert.equal(typeof log.debug, 'function');
  });

  it('does not throw when called', () => {
    const log = createLogger('test');
    // These should not throw
    log.error('test error');
    log.warn('test warn');
    log.info('test info');
    log.debug('test debug');
  });
});
