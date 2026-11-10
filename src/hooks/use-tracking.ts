'use client';

import { useMutation } from '@apollo/client';
import { useCallback, useEffect, useRef } from 'react';

import { TRACK_EVENT } from '@/lib/queries';
import { captureShareRef } from '@/lib/share-ref';

// Generate or retrieve a persistent session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sessionId = sessionStorage.getItem('hub_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem('hub_session_id', sessionId);
  }
  return sessionId;
}

type EventType =
  | 'page_visit'
  | 'signup_click'
  | 'signup_complete'
  | 'share_click'
  | 'coupon_applied'
  | 'payment_started'
  | 'certificate_click';

interface TrackOptions {
  eventType: EventType;
  eventDocumentId?: string;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Hook for tracking analytics events.
 * Fires the mutation silently (fire-and-forget) so it never blocks the UI.
 */
export function useTracking() {
  const [trackMutation] = useMutation(TRACK_EVENT);

  const track = useCallback(
    ({ eventType, eventDocumentId, metadata }: TrackOptions) => {
      try {
        // Who invited this visitor, from a signup's share link (REA-29).
        const ref = captureShareRef();
        const withRef = ref ? { ...(metadata || {}), ref } : metadata;
        trackMutation({
          variables: {
            input: {
              event_type: eventType,
              event_id: eventDocumentId || undefined,
              metadata: withRef || undefined,
              session_id: getSessionId(),
              user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
              referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
            },
          },
        }).catch(() => {
          // silently ignore tracking errors
        });
      } catch {
        // silently ignore
      }
    },
    [trackMutation],
  );

  return { track };
}

/**
 * Hook that automatically tracks a page visit once on mount.
 * Uses a short cooldown (30s) to prevent rapid re-fires from React re-mounts,
 * but allows genuine revisits (e.g. user navigates away and comes back) to be tracked.
 */
const VISIT_COOLDOWN_MS = 30_000; // 30 seconds

export function usePageVisitTracker(eventDocumentId?: string, route?: string) {
  const { track } = useTracking();
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    if (!eventDocumentId) return;

    tracked.current = true;

    const currentRoute = route || (typeof window !== 'undefined' ? window.location.pathname : '');

    // Short cooldown to prevent duplicate fires from React strict-mode / re-mounts,
    // but still allow the same user to be counted when they genuinely revisit the page.
    const dedupeKey = `tracked_${eventDocumentId}_${currentRoute}`;
    if (typeof sessionStorage !== 'undefined') {
      const lastTracked = sessionStorage.getItem(dedupeKey);
      if (lastTracked && Date.now() - Number(lastTracked) < VISIT_COOLDOWN_MS) return;
    }

    track({
      eventType: 'page_visit',
      eventDocumentId,
      metadata: { route: currentRoute },
    });

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(dedupeKey, String(Date.now()));
    }
  }, [eventDocumentId, route, track]);
}
