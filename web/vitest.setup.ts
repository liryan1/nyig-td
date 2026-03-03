import '@testing-library/jest-dom';

// Polyfill ResizeObserver for Radix UI components in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill pointer capture methods for Radix UI Select in jsdom
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || function () { return false; };
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || function () {};
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || function () {};
