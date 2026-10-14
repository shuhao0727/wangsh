type RuntimeWindow = Window & {
  __mermaidReady?: boolean;
  __mermaidLoadFailed?: boolean;
  __katexAutoRenderReady?: boolean;
  __markmapReady?: boolean;
  __markmapLoadFailed?: boolean;
};
type RuntimeAsset = {
  src: string;
  integrity: string;
  readyEvent?: string;
  errorEvent?: string;
  onReady?: () => void;
  onError?: () => void;
};

function markmapFailed(): void {
  (window as RuntimeWindow).__markmapLoadFailed = true;
  window.dispatchEvent(new Event('ws:markmap-error'));
}

function markmapReady(): void {
  (window as RuntimeWindow).__markmapReady = true;
  (window as RuntimeWindow).__markmapLoadFailed = false;
  window.dispatchEvent(new Event('ws:markmap-ready'));
}

const runtimeGroups: readonly (readonly RuntimeAsset[])[] = [
  [
    { src: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js', integrity: 'sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg' },
    { src: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js', integrity: 'sha384-43gviWU0YVjaDtb/GhzOouOXtZMP/7XUzwPTstBeZFe/+rCMvRwr4yROQP43s0Xk', onReady: () => { (window as RuntimeWindow).__katexAutoRenderReady = true; } },
  ],
  [
    { src: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js', integrity: 'sha384-F/bZzf7p3Joyp5psL90p/p89AZJsndkSoGwRpXcZhleCWhd8SnRuoYo4d0yirjJp' },
  ],
  [
    { src: 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.min.js', integrity: 'sha384-EOXBFmc3gx5mb+vn0vPvvGqACToJD24hhacX5Yx+8NUUQrHIle/Qi5Bg9o3zKwW2', readyEvent: 'ws:mermaid-ready', errorEvent: 'ws:mermaid-error' },
  ],
  [
    { src: 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js', integrity: 'sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i', onError: markmapFailed },
    { src: 'https://cdn.jsdelivr.net/npm/markmap-view@0.18.12/dist/browser/index.js', integrity: 'sha384-p+gyhsDIg0RmvIKRr9BBGSyJ9NDDkiFsbilRwdZd20Q8mUL2v7e8+orY4pvTV52w', onError: markmapFailed },
    { src: 'https://cdn.jsdelivr.net/npm/markmap-lib@0.18.12/dist/browser/index.iife.js', integrity: 'sha384-ZlXKtR0wcZqxEYI8i3TPFFiOJR1MEdIzdVvnhSOonCrPsBup4dnkRw49FeYhfsHF', onError: markmapFailed, onReady: markmapReady },
    { src: 'https://cdn.jsdelivr.net/npm/markmap-toolbar@0.18.12/dist/index.js', integrity: 'sha384-AxTWeVj155PcdAy/9J+TpLvAWg4LvelLlP9RbQ7Zvz4dVmjY2/mlMhLfa7+Pkssx' },
  ],
];

let started = false;

// Optional CDN libraries must not delay the application or DOMContentLoaded.
// Each dependency chain advances only after its predecessor loads successfully.
export function startContentRuntimes(): void {
  if (started) return;
  started = true;
  for (const group of runtimeGroups) {
    const load = (index: number) => {
      const asset = group[index];
      if (!asset) return;
      const script = document.createElement('script');
      script.src = asset.src;
      script.integrity = asset.integrity;
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.dataset.wsContentRuntime = 'true';
      script.addEventListener('load', () => {
        asset.onReady?.();
        if (asset.readyEvent) {
          (window as RuntimeWindow).__mermaidReady = true;
          window.dispatchEvent(new Event(asset.readyEvent));
        }
        load(index + 1);
      }, { once: true });
      script.addEventListener('error', () => {
        asset.onError?.();
        if (asset.errorEvent) {
          (window as RuntimeWindow).__mermaidLoadFailed = true;
          window.dispatchEvent(new Event(asset.errorEvent));
        }
      }, { once: true });
      document.head.appendChild(script);
    };
    load(0);
  }
}
