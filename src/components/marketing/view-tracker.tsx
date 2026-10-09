"use client";

import { useEffect, useRef } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/** Fires an analytics event once on mount (using the properties passed in on
 * that first render — later re-renders with new property values are
 * ignored, since this is meant for one-time page-view-style events, not a
 * live stream). Renders nothing. */
export function ViewTracker({
  event,
  properties,
}: {
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    track(event, properties);
    // Intentionally runs once: this component exists purely to fire a
    // single "viewed" event per mount, not to react to prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
