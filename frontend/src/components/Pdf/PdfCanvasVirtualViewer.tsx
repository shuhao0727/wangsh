import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { logger } from "@services/logger";
import { getPdfJs } from "@/utils/pdfInit";

import { LoadingState } from "@/components/ui/loading-state";
export type PdfCanvasVirtualViewerHandle = {
  scrollToPage: (pageNumber: number) => void;
};

type PageMeta = {
  pageNumber: number;
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
};

type Props = {
  data: Uint8Array | null;
  scale?: number;
  maxWidth?: number;
  rootRef?: React.RefObject<HTMLElement | null>;
  maxConcurrentRenders?: number;
  pagePadding?: number;
  pageGap?: number;
  onPdfLoaded?: (pdf: any) => void;
  onFirstPageWrapHeight?: (height: number) => void;
};

type RenderTask = { promise: Promise<void>; cancel: () => void };
// Queues and task ownership belong to one document/scale generation.
type PdfGeneration = {
  cancelled: boolean;
  pdf: any;
  loadingTask: { promise: Promise<any>; destroy?: () => Promise<void> } | null;
  disposedDocuments: Set<any>;
  renderTasks: Set<RenderTask>;
  inFlight: Set<number>;
  rendered: boolean[];
  metas: PageMeta[];
  active: number;
  waiters: Array<(acquired: boolean) => void>;
};

const destroyDocument = (generation: PdfGeneration, pdf: any) => {
  if (generation.disposedDocuments.has(pdf)) return;
  generation.disposedDocuments.add(pdf);
  try {
    void Promise.resolve(pdf.destroy?.()).catch((err) => logger.error("Failed to destroy PDF:", err));
  } catch (err) {
    logger.error("Failed to destroy PDF:", err);
  }
};

const disposeGeneration = (generation: PdfGeneration) => {
  if (generation.cancelled) return;
  generation.cancelled = true;
  for (const task of generation.renderTasks) {
    try { task.cancel(); } catch (err) { logger.error("Failed to cancel PDF render:", err); }
  }
  generation.renderTasks.clear();
  generation.waiters.splice(0).forEach((resolve) => resolve(false));
  if (generation.pdf) {
    destroyDocument(generation, generation.pdf);
  } else {
    try {
      void Promise.resolve(generation.loadingTask?.destroy?.()).catch((err) => logger.error("Failed to cancel PDF loading:", err));
    } catch (err) {
      logger.error("Failed to cancel PDF loading:", err);
    }
  }
};

const PdfCanvasVirtualViewer = forwardRef<PdfCanvasVirtualViewerHandle, Props>(
  (
    {
      data,
      scale = 1.35,
      maxWidth = 980,
      rootRef,
      maxConcurrentRenders = 2,
      pagePadding = 14,
      pageGap = 12,
      onPdfLoaded,
      onFirstPageWrapHeight,
    },
    ref,
  ) => {
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<"load" | "render" | null>(null);
    const [pageMetas, setPageMetas] = useState<PageMeta[]>([]);

    const observerTokenRef = useRef(0);
    const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
    const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
    const generationRef = useRef<PdfGeneration | null>(null);
    const callbacksRef = useRef({ onPdfLoaded, onFirstPageWrapHeight });
    callbacksRef.current = { onPdfLoaded, onFirstPageWrapHeight };

    useImperativeHandle(ref, () => ({
      scrollToPage: (pageNumber: number) => {
        const idx = Math.max(0, Math.min(pageNumber - 1, pageMetas.length - 1));
        const el = pageRefs.current[idx];
        if (!el) return;
        const root = rootRef?.current || null;
        if (root) {
          const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top
            + root.scrollTop - root.clientTop - 8;
          root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
    }));

    useEffect(() => {
      const generation: PdfGeneration = {
        cancelled: false, pdf: null, loadingTask: null, disposedDocuments: new Set(),
        renderTasks: new Set(), inFlight: new Set(), rendered: [], metas: [], active: 0, waiters: [],
      };
      generationRef.current = generation;
      const isCurrent = () => !generation.cancelled && generationRef.current === generation;
      setLoadError(null);
      setPageMetas([]);
      setLoading(Boolean(data));

      const run = async () => {
        try {
          const pdfjs = await getPdfJs();
          if (!isCurrent()) return;
          // PDF.js transfers/detaches typed-array buffers; keep caller bytes reusable for scale reloads.
          generation.loadingTask = pdfjs.getDocument({ data: new Uint8Array(data!) });
          const nextPdf = await generation.loadingTask!.promise;
          generation.pdf = nextPdf;
          if (!isCurrent()) {
            destroyDocument(generation, nextPdf);
            return;
          }
          callbacksRef.current.onPdfLoaded?.(nextPdf);

          const dpr = window.devicePixelRatio || 1;
          const numPages = Number(nextPdf.numPages) || 0;
          const metas: PageMeta[] = new Array(numPages);
          let nextIndex = 1;
          const concurrency = Math.max(1, Math.min(4, numPages));
          await Promise.all(
            Array.from({ length: concurrency }, async () => {
              while (isCurrent() && nextIndex <= numPages) {
                const i = nextIndex++;
                const page = await nextPdf.getPage(i);
                if (!isCurrent()) return;
                const viewport = page.getViewport({ scale: scale * dpr });
                metas[i - 1] = {
                  pageNumber: i, width: Math.floor(viewport.width), height: Math.floor(viewport.height),
                  cssWidth: Math.floor(viewport.width / dpr), cssHeight: Math.floor(viewport.height / dpr),
                };
              }
            }),
          );
          if (!isCurrent()) return;
          generation.metas = metas;
          generation.rendered = new Array(metas.length).fill(false);
          setPageMetas(metas);
          setLoading(false);
          if (metas[0] && metas[0].cssHeight > 0) {
            callbacksRef.current.onFirstPageWrapHeight?.(metas[0].cssHeight + pagePadding * 2);
          }
        } catch (err) {
          if (!isCurrent()) return;
          logger.error("Failed to load PDF:", err);
          disposeGeneration(generation);
          setLoadError("load");
          setLoading(false);
        }
      };
      if (data) void run();
      return () => {
        disposeGeneration(generation);
        if (generationRef.current === generation) generationRef.current = null;
      };
    }, [data, scale, pagePadding]);

    const wrapStyle = useMemo<React.CSSProperties>(
      () => ({
        background: "var(--ws-color-module-shell-surface-2)",
        padding: pagePadding,
        borderRadius: "var(--ws-radius-lg)",
        marginBottom: pageGap,
        display: "flex",
        justifyContent: "center",
        width: "100%",
        maxWidth,
        marginLeft: "auto",
        marginRight: "auto",
      }),
      [maxWidth, pageGap, pagePadding],
    );

    const renderPage = useCallback(async (pageIndex: number) => {
      const generation = generationRef.current;
      if (!generation || generation.cancelled || !generation.pdf || generation.metas !== pageMetas) return;
      if (generation.rendered[pageIndex] || generation.inFlight.has(pageIndex)) return;
      const meta = pageMetas[pageIndex];
      const canvas = canvasRefs.current[pageIndex];
      if (!meta || !canvas) return;
      const isCurrent = () => !generation.cancelled && generationRef.current === generation && canvasRefs.current[pageIndex] === canvas;
      generation.inFlight.add(pageIndex);
      const acquired = generation.active < Math.max(1, maxConcurrentRenders)
        ? (generation.active++, true)
        : await new Promise<boolean>((resolve) => generation.waiters.push(resolve));
      let task: RenderTask | undefined;
      try {
        if (!acquired || !isCurrent()) return;
        const page = await generation.pdf.getPage(meta.pageNumber);
        if (!isCurrent()) return;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("PDF canvas context unavailable");
        canvas.width = meta.width;
        canvas.height = meta.height;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.maxWidth = "100%";
        canvas.style.display = "block";
        canvas.style.borderRadius = "var(--ws-radius-lg)";
        canvas.style.boxShadow = "var(--ws-shadow-sm)";
        const viewport = page.getViewport({ scale: (window.devicePixelRatio || 1) * scale });
        task = page.render({ canvasContext: context, viewport });
        generation.renderTasks.add(task!);
        await task!.promise;
        if (isCurrent()) generation.rendered[pageIndex] = true;
      } catch (err) {
        if (!isCurrent()) return;
        logger.error("Failed to render PDF page:", err);
        disposeGeneration(generation);
        setPageMetas([]);
        setLoadError("render");
      } finally {
        if (task) generation.renderTasks.delete(task);
        generation.inFlight.delete(pageIndex);
        if (acquired) {
          const next = !generation.cancelled ? generation.waiters.shift() : undefined;
          if (next) next(true); // Transfer the occupied slot without letting a new arrival overtake it.
          else generation.active = Math.max(0, generation.active - 1);
        }
      }
    }, [maxConcurrentRenders, pageMetas, scale]);

    useEffect(() => {
      if (!pageMetas.length) return;
      const token = ++observerTokenRef.current;
      const root = rootRef?.current || null;
      const obs = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const idxStr = (e.target as HTMLElement).dataset["pageIndex"];
            const idx = idxStr ? Number(idxStr) : NaN;
            if (!Number.isFinite(idx)) continue;
            if (observerTokenRef.current !== token) return;
            void renderPage(idx);
          }
        },
        { root, rootMargin: "800px 0px", threshold: 0.01 },
      );

      pageRefs.current.forEach((el) => {
        if (el) obs.observe(el);
      });

      return () => {
        observerTokenRef.current += 1;
        obs.disconnect();
      };
    }, [pageMetas.length, renderPage, rootRef]);

    if (!data) return null;

    return (
      <div
        role="region"
        aria-label="PDF 页面"
        aria-busy={loading}
        tabIndex={0}
        className="bg-module-shell-surface-2 text-module-shell-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-module-shell-focus focus-visible:ring-inset"
      >
        {loading ? (
          <LoadingState label="正在加载 PDF 页面…" size="md" className="py-panel-padding text-module-shell-muted" showLabel />
        ) : loadError ? (
          <div role="alert" className="p-panel-padding text-sm bg-error-soft text-error-text">
            <div className="font-semibold">{loadError === "render" ? "PDF 页面渲染失败" : "PDF 页面加载失败"}</div>
            <div>请重新加载预览，或检查 PDF 文件。</div>
          </div>
        ) : !pageMetas.length ? (
          <div role="status" aria-label="暂无可预览页面" className="p-panel-padding text-sm text-module-shell-muted">
            暂无可预览页面
          </div>
        ) : null}
        {pageMetas.map((m, idx) => (
          <div
            key={m.pageNumber}
            id={`page-${m.pageNumber}`}
            data-page-index={idx}
            role="group"
            aria-label={`第 ${m.pageNumber} 页`}
            ref={(el) => {
              pageRefs.current[idx] = el;
            }}
            style={wrapStyle}
          >
            <div style={{ width: "100%", maxWidth: m.cssWidth, aspectRatio: `${m.width} / ${m.height}`, position: "relative" }}>
              <canvas
                ref={(el) => {
                  canvasRefs.current[idx] = el;
                }}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
);

export default PdfCanvasVirtualViewer;
