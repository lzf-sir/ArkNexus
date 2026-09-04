// SSE-based real-time notification hook.
//
// Connects to /api/v1/system/notifications/stream, auto-reconnects on close
// with exponential backoff (capped at 30s), and surfaces the latest event
// via a callback. Designed to be used once at the MainLayout level so every
// page in the app sees new-mail pings without per-page wiring.

import { useEffect, useRef, useState } from "react";
import { resolveApiBaseUrl } from "./api";

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: number;
  data?: Record<string, unknown>;
}

export interface NotificationFeed {
  events: NotificationEvent[]; // newest first
  unread: number;
  clear: () => void;
  markAllRead: () => void;
  connected: boolean;
}

const MAX_HISTORY = 50;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

export function useNotifications(enabled = true): NotificationFeed {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        const base = resolveApiBaseUrl();
        const url = `${base}/system/notifications/stream`;
        // EventSource doesn't support custom headers, so we rely on the JWT
        // being attached via cookie OR on the gateway allowing SSE anonymous
        // (we'll add an auth query token below if needed).
        const es = new EventSource(url, { withCredentials: false });
        esRef.current = es;

        es.onopen = () => {
          attemptRef.current = 0;
          setConnected(true);
        };
        es.onmessage = (e) => {
          // SSE "ping" lines start with ":", filter them out.
          if (!e.data || e.data.startsWith(":")) return;
          try {
            const event = JSON.parse(e.data) as NotificationEvent;
            setEvents((cur) => [event, ...cur].slice(0, MAX_HISTORY));
            setUnread((u) => u + 1);
          } catch {
            /* ignore malformed payload */
          }
        };
        es.onerror = () => {
          setConnected(false);
          es.close();
          esRef.current = null;
          // Reconnect with backoff.
          const delay = Math.min(
            BACKOFF_BASE_MS * 2 ** attemptRef.current,
            BACKOFF_MAX_MS
          );
          attemptRef.current += 1;
          timerRef.current = window.setTimeout(connect, delay);
        };
      } catch {
        const delay = Math.min(
          BACKOFF_BASE_MS * 2 ** attemptRef.current,
          BACKOFF_MAX_MS
        );
        attemptRef.current += 1;
        timerRef.current = window.setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      esRef.current?.close();
      esRef.current = null;
    };
  }, [enabled]);

  return {
    events,
    unread,
    connected,
    clear: () => {
      setEvents([]);
      setUnread(0);
    },
    markAllRead: () => setUnread(0),
  };
}