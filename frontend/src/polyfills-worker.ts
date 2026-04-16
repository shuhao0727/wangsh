// Worker-specific polyfills
// This should be imported in worker scripts before any other code

// Promise.withResolvers polyfill (ES2024) — required by pdfjs-dist 4.x on older browsers
if (typeof Promise.withResolvers === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Promise as any).withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void = undefined!;
    let reject: (reason?: unknown) => void = undefined!;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Export for TypeScript
export {};