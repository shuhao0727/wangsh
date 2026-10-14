import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

afterEach(() => {
  document.querySelectorAll('[data-ws-content-runtime]').forEach(node => node.remove());
  Reflect.deleteProperty(window, '__mermaidReady');
  Reflect.deleteProperty(window, '__mermaidLoadFailed');
  Reflect.deleteProperty(window, '__markmapReady');
  Reflect.deleteProperty(window, '__markmapLoadFailed');
  Reflect.deleteProperty(window, '__katexAutoRenderReady');
  vi.restoreAllMocks();
});

it('starts independent runtimes without awaiting CDN and preserves dependency order and integrity', async () => {
  vi.resetModules();
  const { startContentRuntimes } = await import('./contentRuntimeLoader');
  startContentRuntimes();
  const scripts = () => [...document.querySelectorAll<HTMLScriptElement>('[data-ws-content-runtime]')];
  expect(scripts()).toHaveLength(4);
  expect(scripts().every(script => script.async && script.integrity.startsWith('sha384-') && script.crossOrigin === 'anonymous')).toBe(true);
  expect(scripts().some(script => script.src.includes('markmap-view'))).toBe(false);
  const d3 = scripts().find(script => script.src.includes('/d3@'))!;
  d3.dispatchEvent(new Event('load'));
  const view = scripts().find(script => script.src.includes('markmap-view'))!;
  expect(view).toBeDefined();
  expect(scripts().some(script => script.src.includes('markmap-lib'))).toBe(false);
  view.dispatchEvent(new Event('load'));
  const lib = scripts().find(script => script.src.includes('markmap-lib'))!;
  lib.dispatchEvent(new Event('load'));
  expect((window as Window & { __markmapReady?: boolean }).__markmapReady).toBe(true);
  expect(scripts().filter(script => script.src.includes('markmap-toolbar'))).toHaveLength(1);
  startContentRuntimes();
  expect(scripts()).toHaveLength(7);
});

it('does not load dependents after failure and publishes late Mermaid readiness', async () => {
  vi.resetModules();
  const { startContentRuntimes } = await import('./contentRuntimeLoader');
  const ready = vi.fn();
  window.addEventListener('ws:mermaid-ready', ready);
  startContentRuntimes();
  const scripts = [...document.querySelectorAll<HTMLScriptElement>('[data-ws-content-runtime]')];
  scripts.find(script => script.src.includes('katex'))!.dispatchEvent(new Event('error'));
  expect(document.querySelector('script[src*="auto-render"]')).toBeNull();
  scripts.find(script => script.src.includes('mermaid'))!.dispatchEvent(new Event('load'));
  expect(ready).toHaveBeenCalledOnce();
  window.removeEventListener('ws:mermaid-ready', ready);
});

it('reports failed Markmap prerequisites without requesting dependent scripts', async () => {
  vi.resetModules();
  const { startContentRuntimes } = await import('./contentRuntimeLoader');
  const failed = vi.fn();
  window.addEventListener('ws:markmap-error', failed);
  startContentRuntimes();
  document.querySelector('script[src*="/d3@"]')!.dispatchEvent(new Event('error'));
  expect(failed).toHaveBeenCalledOnce();
  expect(document.querySelector('script[src*="markmap-view"]')).toBeNull();
  window.removeEventListener('ws:markmap-error', failed);
});

function assertNonblockingHtml(html: string): void {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const origin = 'https://wangsh.invalid';
  const external = (href: string) => new URL(href, origin).origin !== origin;
  for (const script of document.querySelectorAll<HTMLScriptElement>('script[src]')) {
    expect(external(script.getAttribute('src')!)).toBe(false);
  }
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[href]')) {
    if (external(link.getAttribute('href')!)) {
      expect(link.rel.toLowerCase().split(/\s+/)).not.toContain('stylesheet');
    }
  }
  const hrefs = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap',
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
  ];
  for (const href of hrefs) {
    const links = [...document.querySelectorAll<HTMLLinkElement>('link')].filter(link => link.getAttribute('href') === href);
    expect(links).toHaveLength(1);
    const link = links[0];
    expect(link.rel).toBe('preload');
    expect(link.getAttribute('as')).toBe('style');
    expect(link.getAttribute('onload')).toMatch(/this\.rel\s*=\s*(['"])stylesheet\1/);
    expect(link.getAttribute('onload')).toMatch(/this\.onload\s*=\s*null/);
    if (href.includes('/katex@')) {
      expect(link.getAttribute('integrity')).toBe('sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+');
      expect(link.getAttribute('crossorigin')).toBe('anonymous');
    }
  }
}

it('keeps every optional external script and stylesheet outside the parser blocking path', () => {
  assertNonblockingHtml(readFileSync(resolve('index.html'), 'utf8'));
});

it.each([
  "<script src='https://cdn.example.invalid/block.js'></script>",
  '<script src="//cdn.example.invalid/block.js"></script>',
  "<link href='https://cdn.example.invalid/block.css' rel='stylesheet'>",
])('rejects blocking HTML independently of quotes and attribute order: %s', (tag) => {
  const html = readFileSync(resolve('index.html'), 'utf8').replace('</head>', `${tag}</head>`);
  expect(() => assertNonblockingHtml(html)).toThrow();
});

it('rejects loss of the KaTeX preload activation even when another valid preload remains', () => {
  const html = readFileSync(resolve('index.html'), 'utf8');
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelector('link[href*="katex@"]')!.removeAttribute('onload');
  expect(() => assertNonblockingHtml(document.documentElement.outerHTML)).toThrow();
});

it('keeps one-shot failure recovery explicit and does not duplicate pending or successful groups', async () => {
  vi.resetModules();
  const { startContentRuntimes } = await import('./contentRuntimeLoader');
  startContentRuntimes();
  document.querySelector('script[src*="mermaid"]')!.dispatchEvent(new Event('error'));
  startContentRuntimes();
  expect(document.querySelectorAll('[data-ws-content-runtime]')).toHaveLength(4);
  expect((window as Window & { __mermaidLoadFailed?: boolean }).__mermaidLoadFailed).toBe(true);
});

it('publishes Markmap core readiness before optional toolbar loading and preserves core on toolbar failure', async () => {
  vi.resetModules();
  const { startContentRuntimes } = await import('./contentRuntimeLoader');
  let toolbarPresentAtCoreReady: boolean | undefined;
  const ready = () => { toolbarPresentAtCoreReady = Boolean(document.querySelector('script[src*="markmap-toolbar"]')); };
  window.addEventListener('ws:markmap-ready', ready);
  try {
    startContentRuntimes();
    for (const part of ['/d3@', 'markmap-view', 'markmap-lib']) {
      document.querySelector(`script[src*="${part}"]`)!.dispatchEvent(new Event('load'));
    }
    expect(toolbarPresentAtCoreReady).toBe(false);
    document.querySelector('script[src*="markmap-toolbar"]')!.dispatchEvent(new Event('error'));
    expect((window as Window & { __markmapReady?: boolean }).__markmapReady).toBe(true);
    expect((window as Window & { __markmapLoadFailed?: boolean }).__markmapLoadFailed).toBe(false);
  } finally {
    window.removeEventListener('ws:markmap-ready', ready);
  }
});
