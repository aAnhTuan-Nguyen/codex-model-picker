import '@testing-library/jest-dom/vitest'
// jsdom has no layout observer. Keyboard/value behavior is exercised here;
// real layout and pointer dragging are checked in Playwright.
if (typeof window !== 'undefined' && !globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
}
