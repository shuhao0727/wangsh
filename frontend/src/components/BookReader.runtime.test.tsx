import React, { StrictMode } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookReader } from '@/pages/Admin/ITTechnology/learning/BookReader';
import type { LearningBook, LearningBookChapter } from '@/pages/Admin/ITTechnology/learning/types';

type MermaidResult = { svg: string };
type RuntimeWindow = Window & { mermaid?: { render: ReturnType<typeof vi.fn> } };
const runtime = window as RuntimeWindow;
const codeA = 'graph TD; A-->B';
const codeB = 'graph TD; C-->D';
const chapter = (slug: string, code: string): LearningBookChapter => ({
  slug, title: slug, summary: '', estimatedMinutes: 1, difficulty: 'beginner',
  goals: [], markdown: `\`\`\`mermaid\n${code}\n\`\`\``, checklist: [],
  experiments: [], glossary: [], references: [],
});
const book: LearningBook = {
  moduleKey: 'ml', title: 'Runtime test', subtitle: '', description: '', audience: '',
  outcomes: [], chapters: [chapter('first', codeA), chapter('second', codeB)],
};
const props = {
  book, activeSlug: 'first', completedChapters: {}, favoriteChapters: {},
  onSelectChapter: vi.fn(), onToggleComplete: vi.fn(), onToggleFavorite: vi.fn(),
};
function deferred() {
  let resolve!: (value: MermaidResult) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<MermaidResult>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const svg = (name: string) => `<svg data-testid="${name}"><text>${name}</text></svg>`;
const ready = () => act(() => { window.dispatchEvent(new Event('ws:mermaid-ready')); });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
let previousMermaid: PropertyDescriptor | undefined;

beforeEach(() => {
  previousMermaid = Object.getOwnPropertyDescriptor(window, 'mermaid');
  delete runtime.mermaid;
});
afterEach(() => {
  cleanup();
  if (previousMermaid) Object.defineProperty(window, 'mermaid', previousMermaid);
  else delete runtime.mermaid;
  vi.restoreAllMocks();
});

describe('BookReader Mermaid consumer lifecycle', () => {
  it('marks component-owned nodes so automatic scans do not reinterpret SVG output', () => {
    const view = render(<BookReader {...props} />);
    expect(view.container.querySelector('pre.mermaid')).toHaveAttribute('data-processed', 'true');
    expect(view.container.querySelector('pre.mermaid')).toHaveTextContent(codeA);
  });

  it('renders the real component when the library becomes ready after mount', async () => {
    const view = render(<BookReader {...props} />);
    expect(view.container.querySelector('pre.mermaid')).toHaveTextContent(codeA);
    const renderDiagram = vi.fn().mockResolvedValue({ svg: svg('late') });
    runtime.mermaid = { render: renderDiagram };
    ready();
    await waitFor(() => expect(view.queryByTestId('late')).not.toBeNull());
    expect(renderDiagram).toHaveBeenCalledTimes(1);
    expect(renderDiagram.mock.calls[0][1].trim()).toBe(codeA);
  });

  it('renders immediately available libraries, without duplicate work on ready events', async () => {
    const renderDiagram = vi.fn().mockResolvedValue({ svg: svg('immediate') });
    runtime.mermaid = { render: renderDiagram };
    const view = render(<BookReader {...props} />);
    await waitFor(() => expect(view.queryByTestId('immediate')).not.toBeNull());
    ready(); ready(); await flush();
    expect(renderDiagram).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('immediate')).toBeInTheDocument();
  });

  it('removes its late-ready subscription on unmount', async () => {
    const view = render(<BookReader {...props} />);
    view.unmount();
    const renderDiagram = vi.fn().mockResolvedValue({ svg: svg('orphan') });
    runtime.mermaid = { render: renderDiagram };
    ready(); await flush();
    expect(renderDiagram).not.toHaveBeenCalled();
  });

  it('does not start a queued render after cleanup', async () => {
    const renderDiagram = vi.fn().mockResolvedValue({ svg: svg('queued') });
    runtime.mermaid = { render: renderDiagram };
    const view = render(<BookReader {...props} />);
    view.unmount(); await flush();
    expect(renderDiagram).not.toHaveBeenCalled();
  });

  it('never writes an in-flight result into a detached pre element', async () => {
    const request = deferred();
    runtime.mermaid = { render: vi.fn().mockReturnValue(request.promise) };
    const view = render(<BookReader {...props} />);
    const pre = view.container.querySelector('pre.mermaid')!;
    await flush();
    expect(runtime.mermaid.render).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => { request.resolve({ svg: svg('detached') }); await request.promise; });
    expect(pre.querySelector('svg')).toBeNull();
    expect(pre.textContent?.trim()).toBe(codeA);
  });

  it('discards old chapter results while the current chapter is rendering', async () => {
    const first = deferred(); const second = deferred();
    const renderDiagram = vi.fn((_id: string, code: string) => code.trim() === codeA ? first.promise : second.promise);
    runtime.mermaid = { render: renderDiagram };
    const view = render(<BookReader {...props} />);
    const oldPre = view.container.querySelector('pre.mermaid')!;
    await flush();
    view.rerender(<BookReader {...props} activeSlug="second" />); await flush();
    await act(async () => { second.resolve({ svg: svg('current') }); await second.promise; });
    await waitFor(() => expect(view.queryByTestId('current')).not.toBeNull());
    await act(async () => { first.resolve({ svg: svg('stale') }); await first.promise; });
    expect(view.queryByTestId('stale')).toBeNull();
    expect(view.getByTestId('current')).toBeInTheDocument();
    expect(oldPre.querySelector('svg')).toBeNull();
    expect(renderDiagram).toHaveBeenCalledTimes(2);
  });

  it('keeps source text after an asynchronous render rejection', async () => {
    const request = deferred();
    runtime.mermaid = { render: vi.fn().mockReturnValue(request.promise) };
    const view = render(<BookReader {...props} />); await flush();
    await act(async () => { request.reject(new Error('render unavailable')); await request.promise.catch(() => {}); });
    await flush();
    expect(view.container.querySelector('pre.mermaid')).toHaveTextContent(codeA);
    expect(view.container.querySelector('pre.mermaid svg')).toBeNull();
  });

  it('keeps source text after a synchronous API throw without crashing the component', async () => {
    runtime.mermaid = { render: vi.fn(() => { throw new Error('synchronous render failure'); }) };
    const view = render(<BookReader {...props} />); await flush();
    expect(view.container.querySelector('pre.mermaid')).toHaveTextContent(codeA);
    expect(view.container.querySelector('pre.mermaid svg')).toBeNull();
  });

  it('ignores ready signals without an instance, then renders exactly once when available', async () => {
    const view = render(<BookReader {...props} />);
    ready(); await flush();
    expect(view.container.querySelector('pre.mermaid svg')).toBeNull();
    const renderDiagram = vi.fn().mockResolvedValue({ svg: svg('valid') });
    runtime.mermaid = { render: renderDiagram }; ready(); ready();
    await waitFor(() => expect(view.queryByTestId('valid')).not.toBeNull());
    expect(renderDiagram).toHaveBeenCalledTimes(1);
  });

  it('survives StrictMode cleanup/replay without rendering the abandoned effect', async () => {
    const renderDiagram = vi.fn().mockResolvedValue({ svg: svg('strict') });
    runtime.mermaid = { render: renderDiagram };
    const view = render(<StrictMode><BookReader {...props} /></StrictMode>);
    await waitFor(() => expect(view.queryByTestId('strict')).not.toBeNull());
    expect(renderDiagram).toHaveBeenCalledTimes(1);
    ready(); await flush(); expect(renderDiagram).toHaveBeenCalledTimes(1);
  });
});
