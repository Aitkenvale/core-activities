"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const EDGE_ZONE_PX = 48;
const MIN_SWIPE_PX = 30; // small deliberate swipes should count
const FAST_FLICK_PX = 15; // a quick flick can be even shorter
const FAST_FLICK_MS = 250;
const MAX_VERTICAL_DRIFT_PX = 60;

// Swipe right from the left edge to go up one menu layer (like iOS's
// edge-swipe-back), for when the app is added to the home screen and loses
// the browser's own back gesture. Tracks touchmove continuously (not just
// start/end) so a fast short flick still registers, and treats touchcancel
// the same as touchend since iOS sometimes cancels rather than ending a
// touch sequence it briefly considered for its own gesture handling.
export function SwipeBack() {
  const router = useRouter();
  const start = useRef<{ x: number; y: number; time: number } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (t.clientX <= EDGE_ZONE_PX) {
        start.current = { x: t.clientX, y: t.clientY, time: Date.now() };
        last.current = { x: t.clientX, y: t.clientY };
      } else {
        start.current = null;
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (!start.current) return;
      const t = e.touches[0];
      last.current = { x: t.clientX, y: t.clientY };
    }
    function finish() {
      const s = start.current;
      const l = last.current;
      start.current = null;
      last.current = null;
      if (!s || !l) return;

      const dx = l.x - s.x;
      const dy = Math.abs(l.y - s.y);
      const elapsed = Date.now() - s.time;
      if (dy > MAX_VERTICAL_DRIFT_PX) return;

      const isDeliberateSwipe = dx > MIN_SWIPE_PX;
      const isFastFlick = dx > FAST_FLICK_PX && elapsed < FAST_FLICK_MS;
      if (isDeliberateSwipe || isFastFlick) router.back();
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", finish, { passive: true });
    window.addEventListener("touchcancel", finish, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", finish);
      window.removeEventListener("touchcancel", finish);
    };
  }, [router]);

  return null;
}
