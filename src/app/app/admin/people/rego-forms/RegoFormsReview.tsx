"use client";

import { useMemo, useState } from "react";
import { updatePerson } from "../actions";
import { formatFullName } from "@/lib/formatName";
import { calculateAge } from "@/lib/category";

type Person = {
  id: string;
  name: string;
  preferredName: string | null;
  dob: string | null;
  householdName: string | null;
  regoFormUrl: string | null;
};

type FormFile = { url: string; filename: string; size: number };

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

// "Edgar of Narcisse & Yacinthe 2025b.pdf" -> { firstName: "Edgar", parentWords: ["narcisse","yacinthe"], year: "2025" }
// "Lyric Miller 2025.pdf" -> { firstName: "Lyric", parentWords: ["miller"], year: "2025" }
function parseFilename(filename: string) {
  const base = filename.replace(/\.pdf$/i, "");
  const yearMatch = base.match(/20\d{2}/);
  const ofMatch = base.match(/^(.+?)\s+of\s+(.+)$/i);
  const firstName = (ofMatch ? ofMatch[1] : base.split(" ")[0]).trim();
  const rest = ofMatch ? ofMatch[2] : base.slice(firstName.length);
  const parentWords = rest
    .replace(/20\d{2}.*$/, "")
    .split(/[^a-zA-Z']+/)
    .map((w) => normalize(w))
    .filter((w) => w.length > 2 && w !== "and");
  return { firstName, parentWords, year: yearMatch?.[0] ?? null };
}

// Best-guess candidates, most likely first — a first-name match is the
// entry bar, then boosted if the household name or the person's own full
// name (which sometimes carries a parent/surname in parens, e.g.
// "Abdulaye Alsati (Faila)") shares a word with the filename's "of X & Y"
// part. Never auto-applied — always requires the admin to click Confirm.
function findCandidates(parsed: ReturnType<typeof parseFilename>, allPeople: Person[]): Person[] {
  const firstNameNorm = normalize(parsed.firstName);
  const firstNameMatches = allPeople.filter((p) => {
    const nameFirst = normalize(p.name.split(/[\s(]/)[0]);
    const prefFirst = p.preferredName ? normalize(p.preferredName.split(/[\s(]/)[0]) : "";
    return nameFirst === firstNameNorm || prefFirst === firstNameNorm;
  });
  if (firstNameMatches.length <= 1) return firstNameMatches;

  const scored = firstNameMatches.map((p) => {
    const haystack = normalize(`${p.name} ${p.householdName ?? ""}`);
    const score = parsed.parentWords.filter((w) => haystack.includes(w)).length;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  // Only trust the tie-break when it actually distinguishes someone — a
  // dead heat still means "let the admin decide", so keep everyone in.
  const topScore = scored[0].score;
  if (topScore > 0 && scored.filter((s) => s.score === topScore).length === 1) {
    return [scored[0].p, ...scored.slice(1).map((s) => s.p)];
  }
  return scored.map((s) => s.p);
}

export function RegoFormsReview({ forms, people, linkedCount }: { forms: FormFile[]; people: Person[]; linkedCount: number }) {
  const [remaining, setRemaining] = useState(forms);
  const [error, setError] = useState<string | null>(null);
  const [linkedThisSession, setLinkedThisSession] = useState(0);

  async function confirmLink(url: string, personId: string) {
    setError(null);
    try {
      await updatePerson(personId, { regoFormUrl: url });
      setRemaining((r) => r.filter((f) => f.url !== url));
      setLinkedThisSession((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that link.");
    }
  }

  function skip(url: string) {
    setRemaining((r) => r.filter((f) => f.url !== url));
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "var(--space-3) var(--space-3) 40px" }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", marginBottom: 4 }}>
        Link Registration Forms
      </h2>
      <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "var(--space-4)" }}>
        {remaining.length} to review, {linkedCount + linkedThisSession} already linked. Each suggestion is a guess —
        check it&rsquo;s the right person before confirming.
      </p>
      {error && <p style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: "var(--space-3)" }}>{error}</p>}

      {remaining.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Nothing left to review.</p>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          {remaining.map((form) => (
            <FormRow key={form.url} form={form} people={people} onConfirm={confirmLink} onSkip={skip} />
          ))}
        </div>
      )}
    </div>
  );
}

function FormRow({
  form,
  people,
  onConfirm,
  onSkip,
}: {
  form: FormFile;
  people: Person[];
  onConfirm: (url: string, personId: string) => void;
  onSkip: (url: string) => void;
}) {
  const parsed = useMemo(() => parseFilename(form.filename), [form.filename]);
  const candidates = useMemo(() => findCandidates(parsed, people), [parsed, people]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(candidates.length === 1 ? candidates[0].id : null);
  const [saving, setSaving] = useState(false);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.preferredName?.toLowerCase().includes(q)).slice(0, 8);
  }, [query, people]);

  async function handleConfirm() {
    if (!selectedId) return;
    setSaving(true);
    await onConfirm(form.url, selectedId);
    setSaving(false);
  }

  return (
    <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", padding: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>{form.filename}</span>
        <a
          href={`/api/admin/rego-form?url=${encodeURIComponent(form.url)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "0.78rem", color: "var(--heading)", textDecoration: "underline", whiteSpace: "nowrap" }}
        >
          Preview
        </a>
      </div>

      {candidates.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{
                padding: "5px 10px",
                borderRadius: "var(--radius-pill)",
                border: `1px solid ${selectedId === c.id ? "var(--deep)" : "var(--border)"}`,
                background: selectedId === c.id ? "var(--deep)" : "var(--card-bg)",
                color: selectedId === c.id ? "var(--cream)" : "var(--text)",
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              {formatFullName(c.name, c.preferredName)}
              {c.householdName ? ` — ${c.householdName}` : ""}
              {c.dob ? ` (${calculateAge(c.dob)})` : ""}
            </button>
          ))}
        </div>
      )}
      {candidates.length === 0 && (
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "8px 0 0" }}>No name match found — search below.</p>
      )}

      <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search a different person…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 160,
            fontSize: 16,
            minHeight: 36,
            padding: "6px 8px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--card-bg)",
            color: "var(--text)",
          }}
        />
        <button
          onClick={handleConfirm}
          disabled={!selectedId || saving}
          style={{
            minHeight: 36,
            padding: "0 14px",
            borderRadius: "var(--radius-pill)",
            border: "none",
            background: "var(--deep)",
            color: "var(--cream)",
            fontSize: "0.8rem",
            cursor: selectedId ? "pointer" : "default",
            opacity: selectedId ? 1 : 0.5,
          }}
        >
          {saving ? "Linking…" : "Confirm Link"}
        </button>
        <button
          onClick={() => onSkip(form.url)}
          style={{ minHeight: 36, padding: "0 10px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.8rem", cursor: "pointer" }}
        >
          Skip
        </button>
      </div>

      {searchResults.length > 0 && (
        <div style={{ marginTop: 6, display: "grid", gap: 2 }}>
          {searchResults.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedId(p.id);
                setQuery(formatFullName(p.name, p.preferredName));
              }}
              style={{
                textAlign: "left",
                padding: "6px 8px",
                border: `1px solid ${selectedId === p.id ? "var(--deep)" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                background: "var(--card-bg)",
                color: "var(--text)",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              {formatFullName(p.name, p.preferredName)}
              {p.householdName ? ` — ${p.householdName}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
