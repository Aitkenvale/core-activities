"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const EDGE_ZONE_PX = 32;
const MIN_SWIPE_PX = 60;
const MAX_VERTICAL_DRIFT_PX = 50;

// Swipe right from the left edge to go up one menu layer (like iOS's
// edge-swipe-back), for when the app is added to the home screen and loses
// the browser's own back gesture.
export function SwipeBack() {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      start.current = t.clientX <= EDGE_ZONE_PX ? { x: t.clientX, y: t.clientY } : null;
    }
    function onTouchEnd(e: TouchEvent) {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = Math.abs(t.clientY - start.current.y);
      start.current = null;
      if (dx > MIN_SWIPE_PX && dy < MAX_VERTICAL_DRIFT_PX) {
        router.back();
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [router]);

  return null;
}
