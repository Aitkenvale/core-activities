// The actual People search UI now lives in SearchOverlay (mounted once,
// globally, in AppLayout) — it's always in the DOM so its input already
// exists the instant Search is tapped, which is what lets iOS Safari open
// the keyboard automatically (see SearchOverlay for the full reasoning).
// This route still needs to exist so /app/people is a real, bookmarkable
// URL and browser back/forward works — SearchOverlay reacts to the
// pathname itself and shows over whatever this renders, so there's
// nothing left for this page to actually render.
export default function PeoplePage() {
  return null;
}
