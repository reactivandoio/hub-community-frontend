import '@testing-library/jest-dom/vitest';

// jsdom lacks a few DOM APIs that Radix primitives (Select, Popover…) call at runtime.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.releasePointerCapture ??= () => {};
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
