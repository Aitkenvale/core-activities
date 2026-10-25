// Measuring and fitting text for the PDF reports, so a table can give each column
// the width it really needs and cut whatever can't fit down to one tidy line with an
// ellipsis, rather than letting a long class name wrap onto a second line.
//
// Pure functions, no fonts to load: Helvetica is the PDF's built-in font, and its
// character widths are fixed.

// How wide each character is in Helvetica, in 1000ths of the font size, from the
// space (32) to the tilde (126). Read from react-pdf's own metrics for its built-in
// Helvetica. Kerning isn't applied: it can only make text a little narrower, so a
// width measured here is never an under-estimate.
const ASCII_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722,
  667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222,
  222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

// What isn't an ASCII character, or an ASCII letter with an accent on it (measured
// as the plain letter, which is exact except for the four i's below). The dashes
// matter: class names are written "Richard St — G2 — ML", and an em dash is a full
// em wide.
const OTHER_WIDTHS: Record<string, number> = {
  "—": 1000,
  "–": 556,
  "…": 1000,
  "‘": 222,
  "’": 222,
  "“": 333,
  "”": 333,
  "•": 350,
  "·": 278,
  Æ: 1000,
  æ: 889,
  Œ: 1000,
  œ: 944,
  Ð: 722,
  ð: 556,
  Þ: 667,
  þ: 556,
  ß: 611,
  Ø: 778,
  ø: 611,
  ì: 278,
  í: 278,
  î: 278,
  ï: 278,
  "×": 584,
  "÷": 584,
  "©": 737,
  "®": 737,
  "™": 1000,
};

// Anything else is taken to be as wide as an em, so a surprise character can only
// ever make a column roomier or a cut earlier, never let text overflow.
const FALLBACK_WIDTH = 1000;

export const ELLIPSIS = "…";

function charWidth(ch: string): number {
  if (/\s/.test(ch)) return ASCII_WIDTHS[0];
  const code = ch.charCodeAt(0);
  if (ch.length === 1 && code >= 32 && code <= 126) return ASCII_WIDTHS[code - 32];
  const other = OTHER_WIDTHS[ch];
  if (other !== undefined) return other;
  const base = ch.normalize("NFD")[0];
  const baseCode = base.charCodeAt(0);
  if (base !== ch && baseCode >= 32 && baseCode <= 126) return ASCII_WIDTHS[baseCode - 32];
  return FALLBACK_WIDTH;
}

// How wide the text is at that font size, in points.
export function textWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const ch of Array.from(text)) units += charWidth(ch);
  return (units * fontSize) / 1000;
}

// The text as it is when it fits, otherwise cut so that it and an ellipsis fit in
// maxWidth. Cut by the character, so as much as possible is kept, then tidied so it
// doesn't end on a stray space, comma or dash before the ellipsis.
export function fitText(text: string, maxWidth: number, fontSize: number): string {
  if (textWidth(text, fontSize) <= maxWidth) return text;
  const ellipsisWidth = textWidth(ELLIPSIS, fontSize);
  if (ellipsisWidth > maxWidth) return "";
  const chars = Array.from(text);
  let end = chars.length;
  while (end > 0 && textWidth(chars.slice(0, end).join(""), fontSize) + ellipsisWidth > maxWidth) end -= 1;
  const kept = chars
    .slice(0, end)
    .join("")
    .replace(/[\s,;:(&\-–—]+$/, "");
  return kept + ELLIPSIS;
}

// Column widths for a table that has `available` points across.
//
// needs[i] is what column i takes to show its longest cell whole; floors[i] is the
// least it is ever worth giving it.
// - If every column can have what it needs, it does, and the room left over is
//   shared out in proportion so the table fills the page.
// - If not, the squeeze falls on the widest columns. There is one common width
//   limit: a column that needs less than it keeps all it needs, a longer one is held
//   to it (its long cells are the ones that get cut), and no column goes below its
//   floor. The limit is the highest one at which the columns still fit the page. A
//   short column such as a mobile number is therefore never touched.
// - keeps[i] says how much column i is worth protecting (1 when left out): its limit
//   is the common limit times that, so a column worth 1.3 holds on to its text
//   longer, and one worth 0.7 is cut sooner.
// Widths come back rounded down to 0.01 so they can never add up to more than there is.
export function fitColumns(needs: number[], rawFloors: number[], available: number, keeps: number[] = needs.map(() => 1)): number[] {
  const total = needs.reduce((a, b) => a + b, 0);
  const round = (n: number) => Math.floor(n * 100) / 100;
  // A column is never owed more than it needs.
  const floors = rawFloors.map((f, i) => Math.min(f, needs[i]));
  if (total <= available) {
    const extra = available - total;
    return needs.map((n) => round(total === 0 ? available / needs.length : n + (extra * n) / total));
  }

  // Not even the floors fit: share the page in proportion to them.
  const floorTotal = floors.reduce((a, b) => a + b, 0);
  if (floorTotal >= available) return floors.map((f) => round((available * f) / floorTotal));

  // What every column adds up to at a given limit; it only ever grows as the limit does.
  const widthAt = (limit: number) => needs.map((n, i) => Math.min(n, Math.max(limit * keeps[i], floors[i])));
  const sumAt = (limit: number) => widthAt(limit).reduce((a, b) => a + b, 0);
  let low = 0;
  let high = Math.max(...needs.map((n, i) => n / keeps[i]));
  for (let step = 0; step < 60; step += 1) {
    const mid = (low + high) / 2;
    if (sumAt(mid) > available) high = mid;
    else low = mid;
  }
  return widthAt(low).map(round);
}
