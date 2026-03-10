
import { FlowNode, FlowEdge } from "./model";
import { nodeSizeForTitle } from "./ports";

export function calculateFitView(
    nodes: FlowNode[],
    edges: FlowEdge[],
    canvasWidth: number,
    canvasHeight: number,
    marginScreen: number = 40
): { scale: number; offsetX: number; offsetY: number } | null {
    if (!canvasWidth || !canvasHeight) return null;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const centersX: number[] = [];

    for (const n of nodes) {
        const s = nodeSizeForTitle(n.shape, n.title);
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + s.w);
        maxY = Math.max(maxY, n.y + s.h);
        centersX.push(n.x + s.w / 2);
    }

    for (const e of edges) {
        const pts =
            e.style === "polyline" || e.style === "bezier"
                ? e.anchors && e.anchors.length
                    ? e.anchors
                    : e.anchor
                        ? [e.anchor]
                        : []
                : [];
        for (const p of pts) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        if (e.fromFree) {
            minX = Math.min(minX, e.fromFree.x);
            minY = Math.min(minY, e.fromFree.y);
            maxX = Math.max(maxX, e.fromFree.x);
            maxY = Math.max(maxY, e.fromFree.y);
        }
        if (e.toFree) {
            minX = Math.min(minX, e.toFree.x);
            minY = Math.min(minY, e.toFree.y);
            maxX = Math.max(maxX, e.toFree.x);
            maxY = Math.max(maxY, e.toFree.y);
        }
    }

    if (!Number.isFinite(minX)) return null;

    centersX.sort((a, b) => a - b);
    const trunkX =
        centersX.length === 0
            ? (minX + maxX) / 2
            : centersX.length % 2
                ? centersX[(centersX.length - 1) / 2]
                : (centersX[centersX.length / 2 - 1] + centersX[centersX.length / 2]) / 2;

    const boundsW = maxX - minX;
    const boundsH = maxY - minY;

    // marginScreen logic from original code:
    // const marginScreen = Math.max(16, Math.min(40, Math.round(Math.min(rect.width, rect.height) * 0.04)));
    // We'll let the caller decide marginScreen or use a default.

    const fitX = (canvasWidth - marginScreen * 2) / Math.max(1, boundsW);
    const fitY = (canvasHeight - marginScreen * 2) / Math.max(1, boundsH);
    const fit = Math.max(0.2, Math.min(1, fitX, fitY));
    const viewScale = fit >= 1 ? 1 : Math.max(0.2, fit);

    const fitScreenW = canvasWidth - marginScreen * 2;
    const fitScreenH = canvasHeight - marginScreen * 2;

    const nextOffsetX =
        boundsW * viewScale <= fitScreenW
            ? Math.round(canvasWidth / 2 - trunkX * viewScale)
            : Math.round(marginScreen - minX * viewScale);

    const nextOffsetY =
        boundsH * viewScale <= fitScreenH
            ? Math.round(marginScreen + (fitScreenH - boundsH * viewScale) / 2 - minY * viewScale)
            : Math.round(marginScreen - minY * viewScale);

    return { scale: viewScale, offsetX: nextOffsetX, offsetY: nextOffsetY };
}

export function calculateFitViewCenter(
    nodes: FlowNode[],
    edges: FlowEdge[],
    canvasWidth: number,
    canvasHeight: number,
    padding: number = 80
): { scale: number; offsetX: number; offsetY: number } | null {
    if (!canvasWidth || !canvasHeight) return null;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const n of nodes) {
        const s = nodeSizeForTitle(n.shape, n.title);
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + s.w);
        maxY = Math.max(maxY, n.y + s.h);
    }

    for (const e of edges) {
        const pts =
            e.style === "polyline" || e.style === "bezier"
                ? e.anchors && e.anchors.length
                    ? e.anchors
                    : e.anchor
                        ? [e.anchor]
                        : []
                : [];
        for (const p of pts) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
    }

    if (!Number.isFinite(minX)) return null;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const fitX = (canvasWidth - padding) / Math.max(1, contentW);
    const fitY = (canvasHeight - padding) / Math.max(1, contentH);
    const fit = Math.max(0.2, Math.min(1, fitX, fitY));
    const nextScale = fit >= 1 ? 1 : Math.max(0.2, fit);
    const contentCenterX = minX + contentW / 2;
    const contentCenterY = minY + contentH / 2;
    const nextOffsetX = Math.round(canvasWidth / 2 - contentCenterX * nextScale);
    const nextOffsetY = Math.round(canvasHeight / 2 - contentCenterY * nextScale);

    return { scale: nextScale, offsetX: nextOffsetX, offsetY: nextOffsetY };
}
