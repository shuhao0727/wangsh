import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Spin } from "antd";

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
    const [pageMetas, setPageMetas] = useState<PageMeta[]>([]);

    const loadTokenRef = useRef(0);
    const observerTokenRef = useRef(0);
    const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
    const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
    const inFlightRef = useRef<Set<number>>(new Set());
    const renderedRef = useRef<boolean[]>([]);
    const pdfRef = useRef<any>(null);

    const queueRef = useRef<{ active: number; waiters: Array<() => void> }>({ active: 0, waiters: [] });
    const acquire = useCallback(async () => {
      if (queueRef.current.active < maxConcurrentRenders) {
        queueRef.current.active += 1;
        return;
      }
      await new Promise<void>((resolve) => {
        queueRef.current.waiters.push(resolve);
      });
      queueRef.current.active += 1;
    }, [maxConcurrentRenders]);
    const release = useCallback(() => {
      queueRef.current.active = Math.max(0, queueRef.current.active - 1);
      const next = queueRef.current.waiters.shift();
      if (next) next();
    }, []);

    useImperativeHandle(ref, () => ({
      scrollToPage: (pageNumber: number) => {
        const idx = Math.max(0, Math.min(pageNumber - 1, pageMetas.length - 1));
        const el = pageRefs.current[idx];
        if (!el) return;
        const root = rootRef?.current || null;
        if (root) {
          root.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
    }));

    useEffect(() => {
      const token = ++loadTokenRef.current;
      if (!data) {
        pdfRef.current = null;
        setPageMetas([]);
        renderedRef.current = [];
        setLoading(false);
        return;
      }

      setLoading(true);
      setPageMetas([]);
      renderedRef.current = [];
      inFlightRef.current.clear();

      const run = async () => {
        const pdfjs: any = await import("pdfjs-dist/webpack.mjs");
        const nextPdf = await pdfjs.getDocument({ data }).promise;
        if (loadTokenRef.current !== token) return;
        pdfRef.current = nextPdf;
        onPdfLoaded?.(nextPdf);

        const dpr = window.devicePixelRatio || 1;
        const numPages = Number(nextPdf.numPages) || 0;
        const metas: PageMeta[] = new Array(numPages);

        let nextIndex = 1;
        const concurrency = Math.max(1, Math.min(4, numPages));
        await Promise.all(
          Array.from({ length: concurrency }, async () => {
            while (nextIndex <= numPages) {
              const i = nextIndex;
              nextIndex += 1;
              try {
                const page = await nextPdf.getPage(i);
                const viewport = page.getViewport({ scale: scale * dpr });
                metas[i - 1] = {
                  pageNumber: i,
                  width: Math.floor(viewport.width),
                  height: Math.floor(viewport.height),
                  cssWidth: Math.floor(viewport.width / dpr),
                  cssHeight: Math.floor(viewport.height / dpr),
                };
              } catch {
                metas[i - 1] = { pageNumber: i, width: 0, height: 0, cssWidth: 0, cssHeight: 0 };
              }
            }
          }),
        );

        if (loadTokenRef.current !== token) return;
        setPageMetas(metas);
        const flags = new Array(metas.length).fill(false);
        renderedRef.current = flags;
        setLoading(false);
        if (metas[0] && metas[0].cssHeight > 0) {
          onFirstPageWrapHeight?.(metas[0].cssHeight + pagePadding * 2);
        }
      };

      run().catch(() => {
        if (loadTokenRef.current !== token) return;
        setLoading(false);
      });
    }, [data, scale, pagePadding, onPdfLoaded, onFirstPageWrapHeight]);

    const wrapStyle = useMemo<React.CSSProperties>(
      () => ({
        background: "var(--ws-color-surface-2)",
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
      const curPdf = pdfRef.current;
      if (!curPdf) return;
      if (renderedRef.current[pageIndex]) return;
      if (inFlightRef.current.has(pageIndex)) return;
      const meta = pageMetas[pageIndex];
      const canvas = canvasRefs.current[pageIndex];
      if (!meta || !canvas) return;

      inFlightRef.current.add(pageIndex);
      await acquire();
      try {
        const page = await curPdf.getPage(meta.pageNumber);
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = meta.width;
        canvas.height = meta.height;
        canvas.style.width = `${meta.cssWidth}px`;
        canvas.style.height = `${meta.cssHeight}px`;
        canvas.style.maxWidth = "100%";
        canvas.style.display = "block";
        canvas.style.borderRadius = "var(--ws-radius-lg)";
        canvas.style.boxShadow = "var(--ws-shadow-sm)";
        const viewport = page.getViewport({ scale: (window.devicePixelRatio || 1) * scale });
        await page.render({ canvasContext: context, viewport }).promise;
        renderedRef.current = (() => {
          const next = [...renderedRef.current];
          next[pageIndex] = true;
          return next;
        })();
      } finally {
        release();
        inFlightRef.current.delete(pageIndex);
      }
    }, [acquire, pageMetas, release, scale]);

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
            renderPage(idx);
          }
        },
        { root, rootMargin: "800px 0px", threshold: 0.01 },
      );

      pageRefs.current.forEach((el) => {
        if (el) obs.observe(el);
      });

      return () => {
        obs.disconnect();
      };
    }, [pageMetas.length, renderPage, rootRef]);

    if (!data) return null;

    return (
      <div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Spin />
          </div>
        ) : null}
        {pageMetas.map((m, idx) => (
          <div
            key={m.pageNumber}
            id={`page-${m.pageNumber}`}
            data-page-index={idx}
            ref={(el) => {
              pageRefs.current[idx] = el;
            }}
            style={wrapStyle}
          >
            <div style={{ width: m.cssWidth, height: m.cssHeight, display: "flex", justifyContent: "center" }}>
              <canvas
                ref={(el) => {
                  canvasRefs.current[idx] = el;
                }}
                style={{ width: m.cssWidth, height: m.cssHeight }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
);

export default PdfCanvasVirtualViewer;
