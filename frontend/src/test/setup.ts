import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = window.ResizeObserver ?? ResizeObserverMock;

const elementPrototype = Element.prototype as Element & {
  hasPointerCapture?: (pointerId: number) => boolean;
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
  scrollIntoView?: (arg?: boolean | ScrollIntoViewOptions) => void;
};

elementPrototype.hasPointerCapture ??= () => false;
elementPrototype.setPointerCapture ??= () => undefined;
elementPrototype.releasePointerCapture ??= () => undefined;
elementPrototype.scrollIntoView ??= () => undefined;
