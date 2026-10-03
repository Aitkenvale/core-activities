"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The app's own "are you sure?" box, used instead of the browser's confirm().
// That one is a system dialog which, after a few, offers a "don't show this
// again" tick — and ticking it turns every later question into a silent No.
// For a safeguard that has to keep asking, that is no good.
//
// It opens on the safe choice (cancel), Escape and a tap outside both cancel,
// and it is portaled to <body> so it sits above whatever screen asked. Leave out
// confirmLabel/onConfirm and it is a plain notice with one button (cancelLabel,
// say "OK") — for explaining why something couldn't be done.
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel: string;
  onConfirm?: () => void;
  onCancel: () => void;
}) {
  const safeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    safeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const buttonStyle: React.CSSProperties = {
    minHeight: "var(--tap-min)",
    padding: "0 18px",
    borderRadius: "var(--radius-pill)",
    border: "1px solid var(--border)",
    fontSize: "0.85rem",
    cursor: "pointer",
  };

  return createPortal(
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.65)" }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 400px)",
          maxHeight: "86vh",
          overflowY: "auto",
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-5)",
        }}
      >
        <h4 id={titleId} style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.2rem", color: "var(--heading)", marginBottom: "var(--space-3)" }}>
          {title}
        </h4>
        <div id={bodyId} style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.5 }}>
          {children}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: "var(--space-5)" }}>
          <button ref={safeRef} type="button" onClick={onCancel} style={{ ...buttonStyle, background: "var(--card-bg)", color: "var(--text)" }}>
            {cancelLabel}
          </button>
          {onConfirm && confirmLabel && (
            <button type="button" onClick={onConfirm} style={{ ...buttonStyle, background: "var(--deep)", color: "var(--cream)" }}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
