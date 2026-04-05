// Type augmentation for Promise.withResolvers polyfill (see src/polyfills.ts)
// The runtime polyfill covers browsers that lack ES2024 support.
interface PromiseConstructor {
  withResolvers<T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
}
