"use client";

// Shared top-right "X" dismiss button for popups/modals — anchors to the
// modal card's actual top-right corner, so every popup has one obvious,
// consistent way out regardless of its size (some of these run tall enough
// on mobile that scrolling down to a Cancel/Auto-Save button isn't
// reliable). The card it's placed inside must be position:relative or
// position:fixed for this to anchor to the card rather than the viewport.
export function ModalCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Close"
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        width: 30,
        height: 30,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "none",
        color: "var(--muted)",
        fontSize: "1.3rem",
        lineHeight: 1,
        cursor: "pointer",
        borderRadius: "var(--radius-pill)",
      }}
    >
      ×
    </button>
  );
}
