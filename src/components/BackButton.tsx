"use client";

import { useRouter, usePathname } from "next/navigation";

// One level up the menu hierarchy (not browser history) — same logic the
// old swipe-back gesture used before it was removed in favour of the
// bottom tab bar, now surfaced as an explicit tap target instead.
export function getParentPath(pathname: string): string | null {
  if (pathname === "/app") return null; // already top level

  const sessionMatch = pathname.match(/^\/app\/attendance\/[^/]+\/[^/]+\/session$/);
  if (sessionMatch) {
    const [categoryId] = pathname.split("/attendance/")[1].split("/");
    return `/app/attendance/${categoryId}`;
  }

  const segments = pathname.split("/").filter(Boolean);
  segments.pop();
  return "/" + segments.join("/");
}

// Deliberately invisible (no icon, no border, no background) — an overlay
// tap target in the left margin above the title, rather than an inline flex
// sibling, so it doesn't push the title rightward and break its left
// alignment with the page content below it. The parent header is
// position:sticky, which is itself a positioned element, so this positions
// relative to it without needing an extra wrapper.
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const parent = getParentPath(pathname);

  if (!parent) return null;

  return (
    <button
      onClick={() => router.push(parent)}
      aria-label="Back"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 44,
        height: "var(--app-header-height)",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    />
  );
}
