import { useEffect, useRef } from 'react';
import { config, getStoredAccessToken } from '@services';

export function useAdminSSE(
  eventType: string,
  onEvent: () => void
) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let stopped = false;
    let stream: EventSource | null = null;
    let retryTimer: NodeJS.Timeout | null = null;
    let debounceTimer: NodeJS.Timeout | null = null;
    let retryCount = 0;

    const connect = () => {
      if (stopped) return;

      const token = getStoredAccessToken();
      const query = token ? `?token=${encodeURIComponent(token)}` : '';
      const streamUrl = `${config.apiUrl}/admin/stream${query}`;

      try {
        stream = new EventSource(streamUrl, { withCredentials: true });

        stream.onopen = () => {
          retryCount = 0;
        };

        stream.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data || '{}');
            if (payload?.type === 'connected') return;
            if (payload?.type === eventType) {
              // 300ms debounce: 快速连续事件只触发一次回调
              if (debounceTimer) clearTimeout(debounceTimer);
              debounceTimer = setTimeout(() => {
                onEventRef.current();
              }, 300);
            }
          } catch {}
        };

        stream.onerror = () => {
          closeStream();
          scheduleReconnect();
        };
      } catch {
        closeStream();
        scheduleReconnect();
      }
    };

    const closeStream = () => {
      if (stream) {
        stream.close();
        stream = null;
      }
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      clearRetry();
      // 指数退避: 1s → 2s → 4s → ... → 30s cap
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      retryCount++;
      retryTimer = setTimeout(connect, delay);
    };

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    connect();

    return () => {
      stopped = true;
      clearRetry();
      closeStream();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };
  }, [eventType]);
}
