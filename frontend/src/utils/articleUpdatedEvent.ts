export type ArticleUpdatedPayload = {
  articleId: number;
  action: "created" | "updated";
  updatedAt?: string;
  slug?: string;
  oldSlug?: string;
  newSlug?: string;
  title?: string;
};

export type ArticleUpdatedEventMeta = {
  id: string;
  ts: number;
  sourceId: string;
};

type ArticleUpdatedEvent = ArticleUpdatedEventMeta & {
  type: "article_updated";
  payload: ArticleUpdatedPayload;
};

const CHANNEL_NAME = "ws:article-updated:v1";
const STORAGE_KEY = "ws:article-updated:v1";
const THROTTLE_MS = 800;
const SEEN_TTL_MS = 60_000;
const DELIVER_DEBOUNCE_MS = 150;

const sourceId =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;

let seq = 0;
const lastPublishAtByKey = new Map<string, number>();
const seenAtById = new Map<string, number>();

const cleanupSeen = (now: number) => {
  const toDelete: string[] = [];
  seenAtById.forEach((ts, id) => {
    if (now - ts > SEEN_TTL_MS) toDelete.push(id);
  });
  for (let i = 0; i < toDelete.length; i++) seenAtById.delete(toDelete[i]);
};

const markSeen = (id: string, now: number) => {
  seenAtById.set(id, now);
  cleanupSeen(now);
};

const isSeen = (id: string) => seenAtById.has(id);

const shouldThrottlePublish = (key: string, now: number) => {
  const last = lastPublishAtByKey.get(key) || 0;
  if (now - last < THROTTLE_MS) return true;
  lastPublishAtByKey.set(key, now);
  return false;
};

const safeParseEvent = (data: unknown): ArticleUpdatedEvent | null => {
  try {
    const raw =
      typeof data === "string"
        ? JSON.parse(data)
        : (data as Record<string, unknown>);
    if (!raw || typeof raw !== "object") return null;
    if ((raw as any).type !== "article_updated") return null;
    if (typeof (raw as any).id !== "string") return null;
    if (typeof (raw as any).ts !== "number") return null;
    if (typeof (raw as any).sourceId !== "string") return null;
    const payload = (raw as any).payload;
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.articleId !== "number") return null;
    if (payload.action !== "created" && payload.action !== "updated") return null;
    if (
      payload.updatedAt !== undefined &&
      typeof payload.updatedAt !== "string"
    )
      return null;
    if (payload.slug !== undefined && typeof payload.slug !== "string") return null;
    if (payload.oldSlug !== undefined && typeof payload.oldSlug !== "string")
      return null;
    if (payload.newSlug !== undefined && typeof payload.newSlug !== "string")
      return null;
    if (payload.title !== undefined && typeof payload.title !== "string") return null;
    return raw as ArticleUpdatedEvent;
  } catch {
    return null;
  }
};

export const publishArticleUpdated = (
  payload: ArticleUpdatedPayload,
): ArticleUpdatedEventMeta | null => {
  const now = Date.now();
  const key = `${payload.articleId}:${payload.action}`;
  if (shouldThrottlePublish(key, now)) return null;

  const evt: ArticleUpdatedEvent = {
    type: "article_updated",
    id: `${sourceId}:${now}:${seq++}`,
    ts: now,
    sourceId,
    payload,
  };

  markSeen(evt.id, now);

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage(evt);
      ch.close();
      return { id: evt.id, ts: evt.ts, sourceId: evt.sourceId };
    }
  } catch {}

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(evt));
  } catch {}

  return { id: evt.id, ts: evt.ts, sourceId: evt.sourceId };
};

export const subscribeArticleUpdated = (
  handler: (payload: ArticleUpdatedPayload, meta: ArticleUpdatedEventMeta) => void,
): (() => void) => {
  const deliverTimers = new Map<number, number>();

  const deliver = (payload: ArticleUpdatedPayload, meta: ArticleUpdatedEventMeta) => {
    const id = payload.articleId;
    const prev = deliverTimers.get(id);
    if (prev) window.clearTimeout(prev);
    const t = window.setTimeout(() => {
      deliverTimers.delete(id);
      handler(payload, meta);
    }, DELIVER_DEBOUNCE_MS);
    deliverTimers.set(id, t);
  };

  const handleIncoming = (incoming: unknown) => {
    const evt = safeParseEvent(incoming);
    if (!evt) return;
    if (evt.sourceId === sourceId) return;
    if (isSeen(evt.id)) return;
    markSeen(evt.id, Date.now());
    deliver(evt.payload, { id: evt.id, ts: evt.ts, sourceId: evt.sourceId });
  };

  let ch: BroadcastChannel | null = null;
  let bcListener: ((e: MessageEvent) => void) | null = null;
  let storageListener: ((e: StorageEvent) => void) | null = null;

  try {
    if (typeof BroadcastChannel !== "undefined") {
      ch = new BroadcastChannel(CHANNEL_NAME);
      bcListener = (e: MessageEvent) => handleIncoming(e.data);
      ch.addEventListener("message", bcListener);
    } else {
      storageListener = (e: StorageEvent) => {
        if (e.key !== STORAGE_KEY) return;
        if (!e.newValue) return;
        handleIncoming(e.newValue);
      };
      window.addEventListener("storage", storageListener);
    }
  } catch {
    storageListener = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (!e.newValue) return;
      handleIncoming(e.newValue);
    };
    window.addEventListener("storage", storageListener);
  }

  return () => {
    deliverTimers.forEach((t) => window.clearTimeout(t));
    deliverTimers.clear();

    if (ch && bcListener) {
      try {
        ch.removeEventListener("message", bcListener);
      } catch {}
      try {
        ch.close();
      } catch {}
    }
    if (storageListener) {
      try {
        window.removeEventListener("storage", storageListener);
      } catch {}
    }
  };
};
