import { TextEncoder } from 'util';
import { jest } from '@jest/globals';

globalThis.TextEncoder = TextEncoder;

const store: Record<string, string> = {};

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    get length(): number {
      return Object.keys(store).length;
    },
    key: (index: number): string | null => Object.keys(store)[index] ?? null,
  },
  writable: true,
  configurable: true,
});

// Polyfill scrollIntoView for jsdom (used by CommandPalette)
Element.prototype.scrollIntoView = () => {};

// Suppress console output during tests to avoid Jest detecting them as failures
console.info = jest.fn();
console.debug = jest.fn();
console.warn = jest.fn();
