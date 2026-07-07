"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const EDGE_ZONE_FRACTION = 0.35; // of screen width, not a fixed pixel value
const MIN_SWIPE_PX = 30; // small deliberate swipes should count
const FAST_FLICK_PX = 15; // a quick flick can be even shorter
const FAST_FLICK_MS = 250;
const MAX_VERTICAL_DRIFT_PX = 60;

// One level up the menu hierarchy — not browser history. Using router.back()
// meant the swipe sometimes retraced date-pill navigations or did nothing at
// all if there was no history (e.g. arriving via a fresh load), instead of
// reliably going up to the parent menu.
function getParentPath(pathname: string): string | null {
  if (pathname === "/app") return null; // already top level

  const sessionMatch = pathname.match(/^\/app\/attendance\/[^/]+\/[^/]+\/session$/);
  if (sessionMatch) {
    const [, categoryId] = pathname.split("/attendance/")[1].split("/");
    return `/app/attendance/${categoryId}`;
  }

  const segments = pathname.split("/").filter(Boolean);
  segments.pop();
  return "/" + segments.join("/");
}

// Swipe right from the left edge to go up one menu layer (like iOS's
// edge-swipe-back), for when the app is added to the home screen and loses
// the browser's own back gesture. Tracks touchmove continuously (not just
// start/end) so a fast short flick still registers, and treats touchcancel
// the same as touchend since iOS sometimes cancels rather than ending a
// touch sequence it briefly considered for its own gesture handling.
export function SwipeBack() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const start = useRef<{ x: number; y: number; time: number } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (t.clientX <= window.innerWidth * EDGE_ZONE_FRACTION) {
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
      if (isDeliberateSwipe || isFastFlick) {
        const parent = getParentPath(pathnameRef.current);
        if (parent) router.push(parent);
      }
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
