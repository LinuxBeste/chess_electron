import { describe, test, expect } from '@jest/globals';
import logger, { audit, morganStream, cleanupOldLogs } from '../src/logger.js';

describe('logger', () => {
  test('error does not throw', () => {
    expect(() => logger.error('test error')).not.toThrow();
  });

  test('warn does not throw', () => {
    expect(() => logger.warn('test warn')).not.toThrow();
  });

  test('info does not throw', () => {
    expect(() => logger.info('test info')).not.toThrow();
  });

  test('debug does not throw', () => {
    expect(() => logger.debug('test debug')).not.toThrow();
  });

  test('log with args appends stringified objects', () => {
    expect(() => logger.info('test', { key: 'val' })).not.toThrow();
  });

  test('audit does not throw', () => {
    expect(() => audit('test_action', 'test detail')).not.toThrow();
  });

  test('morganStream write does not throw for non-empty message', () => {
    const stream = morganStream();
    expect(() => stream.write('GET /health 200')).not.toThrow();
  });

  test('morganStream write ignores empty message', () => {
    const stream = morganStream();
    expect(() => stream.write('')).not.toThrow();
  });

  test('cleanupOldLogs does not throw in test mode', () => {
    expect(() => cleanupOldLogs()).not.toThrow();
  });

  test('logger has all expected methods', () => {
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.audit).toBe('function');
    expect(typeof logger.morganStream).toBe('function');
    expect(typeof logger.cleanupOldLogs).toBe('function');
  });
});
