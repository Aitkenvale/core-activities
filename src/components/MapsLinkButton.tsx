"use client";

// Opens the address in whichever maps app the device actually treats as
// default — Apple Maps via universal link on iOS, Google Maps everywhere
// else (Android intent-handles this into its own app when installed).
// Computed at click time (not as a static href) so there's no server/client
// mismatch from reading navigator.userAgent during render.
//
// Same-tab navigation (not window.open/_blank) is deliberate — iOS
// intercepts the universal link and hands off to the Maps app before this
// tab actually navigates away, so the original page is still sitting right
// there underneath. A new tab instead leaves behind a genuinely blank tab
// with nothing ever loaded into it, which is what showed up as a black
// screen after returning from Maps — Safari's "back to <site>" link goes
// to that empty tab, not the app, so getting back needs closing the tab.
export function MapsLinkButton({ address }: { address: string }) {
  function handleClick() {
    const encoded = encodeURIComponent(address);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const href = isIOS ? `https://maps.apple.com/?q=${encoded}` : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    window.location.href = href;
  }

  return (
    <button
      onClick={handleClick}
      title="Open in Maps"
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        padding: 0,
        border: "none",
        background: "none",
        color: "var(--warm)",
        cursor: "pointer",
      }}
    >
      <MapPinIcon />
    </button>
  );
}

function MapPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
