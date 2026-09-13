"use client";

// Same circular button treatment as AccountMenu/SearchButton — a visible
// close control filling the header's top-right slot on the pages that used
// to show the login icon there (Activity/Attendance sub-pages, People).
export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Close"
      style={{
        flexShrink: 0,
        width: "var(--tap-min)",
        height: "var(--tap-min)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-pill)",
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        color: "var(--muted)",
        cursor: "pointer",
      }}
    >
      <CloseIcon />
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
