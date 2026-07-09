"use client";

import { useEffect, useRef, useState } from "react";
import {
  searchPeopleDirectory,
  updatePersonMobile,
  updatePersonNotes,
  updateHouseholdAddress,
  addHouseholdMember,
} from "./actions";
import { formatFullName } from "@/lib/formatName";

type Result = {
  id: string;
  name: string;
  preferredName: string | null;
  householdId: string | null;
  householdName: string | null;
  householdAddress: string | null;
  mobile: string | null;
  comment: string | null;
};

const compactInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: "0.85rem",
  minHeight: 36,
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--text)",
};

export function PeopleSearch({ isAdmin }: { isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // autoFocus alone can be unreliable right after a client-side route
  // transition — focusing imperatively on mount is more consistent. Note
  // this puts the caret in the box either way, but iOS Safari specifically
  // still won't slide the on-screen keyboard up on a script-triggered focus
  // (only a real tap does that) — that part is a platform restriction, not
  // something fixable from here.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleChange(value: string) {
    setQuery(value);
    setExpandedId(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setResults(await searchPeopleDirectory(value));
  }

  function patchResult(id: string, patch: Partial<Result>) {
    setResults((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <>
      {/* No body heading here — AppHeader's sticky title already shows
          "Find Person" for this route (src/lib/pageTitle.ts). Kept compact
          throughout (search box included) so the whole flow — search,
          result, and the edit form — fits one mobile screen. */}
      <input
        ref={inputRef}
        autoFocus
        placeholder="Search by name or household…"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        style={{ ...compactInputStyle, fontSize: 16, minHeight: "var(--tap-min)", marginTop: "var(--space-2)" }}
      />

      <div style={{ marginTop: "var(--space-2)", display: "grid", gap: 6 }}>
        {results.map((r) => {
          const expanded = expandedId === r.id;
          return (
            <div key={r.id} style={{ background: "var(--card-bg)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)" }}>
              <button
                onClick={() => setExpandedId(expanded ? null : r.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  minHeight: "var(--tap-min)",
                  padding: "8px var(--space-3)",
                  background: "none",
                  border: "none",
                  fontSize: "0.9rem",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                {formatFullName(r.name, r.preferredName)}
              </button>
              {expanded && (
                <PersonDetail result={r} isAdmin={isAdmin} onChange={(patch) => patchResult(r.id, patch)} />
              )}
            </div>
          );
        })}
        {query.trim().length >= 2 && results.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No matches.</p>
        )}
      </div>
    </>
  );
}

function PersonDetail({
  result,
  isAdmin,
  onChange,
}: {
  result: Result;
  isAdmin: boolean;
  onChange: (patch: Partial<Result>) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <PersonEditForm result={result} onChange={onChange} onDone={() => setEditing(false)} />;
  }

  return (
    <div style={{ padding: "0 var(--space-3) var(--space-3)", display: "grid", gap: 4 }}>
      <DetailRow label="Real Name" value={result.name} />
      <DetailRow label="AKA" value={result.preferredName ?? "—"} />
      <DetailRow label="Mobile" value={result.mobile ?? "—"} href={result.mobile ? `tel:${result.mobile}` : undefined} />
      <DetailRow label="Household" value={result.householdName ?? "—"} />
      <DetailRow
        label="Address"
        value={result.householdAddress ?? "—"}
        action={result.householdAddress ? <MapsLinkButton address={result.householdAddress} /> : undefined}
      />
      {result.comment && <DetailRow label="Notes" value={result.comment} />}
      {isAdmin && (
        <button
          onClick={() => setEditing(true)}
          style={{
            justifySelf: "start",
            marginTop: 4,
            minHeight: 32,
            padding: "0 14px",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--deep)",
            background: "var(--deep)",
            color: "var(--cream)",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          Edit
        </button>
      )}
    </div>
  );
}

function PersonEditForm({
  result,
  onChange,
  onDone,
}: {
  result: Result;
  onChange: (patch: Partial<Result>) => void;
  onDone: () => void;
}) {
  const [mobile, setMobile] = useState(result.mobile ?? "");
  const [address, setAddress] = useState(result.householdAddress ?? "");
  const [notes, setNotes] = useState(result.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const tasks: Promise<unknown>[] = [];
      if (mobile !== (result.mobile ?? "")) tasks.push(updatePersonMobile(result.id, mobile));
      if (result.householdId && address !== (result.householdAddress ?? "")) {
        tasks.push(updateHouseholdAddress(result.householdId, address));
      }
      if (notes !== (result.comment ?? "")) tasks.push(updatePersonNotes(result.id, notes));
      await Promise.all(tasks);
      onChange({
        mobile: mobile.trim() || null,
        householdAddress: result.householdId ? address.trim() || null : result.householdAddress,
        comment: notes.trim() || null,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "0 var(--space-3) var(--space-3)", display: "grid", gap: 6 }}>
      <FieldInput label="Mobile" value={mobile} onChange={setMobile} />
      {result.householdId ? (
        <FieldInput label="Address" value={address} onChange={setAddress} />
      ) : (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>No household on file — address can&rsquo;t be set.</p>
      )}
      <FieldInput label="Notes" value={notes} onChange={setNotes} />

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            minHeight: 32,
            padding: "0 14px",
            borderRadius: "var(--radius-pill)",
            border: "none",
            background: "var(--deep)",
            color: "var(--cream)",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onDone}
          style={{ minHeight: 32, padding: "0 14px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
      {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", margin: 0 }}>{error}</p>}

      {result.householdId &&
        (addingMember ? (
          <AddHouseholdMemberForm householdId={result.householdId} onDone={() => setAddingMember(false)} />
        ) : (
          <button
            onClick={() => setAddingMember(true)}
            style={{
              marginTop: 4,
              justifySelf: "start",
              minHeight: 32,
              padding: "0 12px",
              border: "1px dashed var(--gold)",
              borderRadius: "var(--radius-sm)",
              background: "none",
              color: "var(--warm)",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            + Add household member
          </button>
        ))}
    </div>
  );
}

function AddHouseholdMemberForm({ householdId, onDone }: { householdId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [personType, setPersonType] = useState<"child" | "adult">("child");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addHouseholdMember(householdId, name, personType, dob || null);
      setAdded(true);
    } finally {
      setBusy(false);
    }
  }

  if (added) {
    return (
      <p style={{ fontSize: "0.8rem", color: "var(--text)", margin: 0 }}>
        Added.{" "}
        <button onClick={onDone} style={{ background: "none", border: "none", color: "var(--warm)", fontSize: "0.75rem", cursor: "pointer" }}>
          Close
        </button>
      </p>
    );
  }

  return (
    <div style={{ marginTop: 4, padding: "var(--space-2)", border: "1px dashed var(--border)", borderRadius: "var(--radius-sm)", display: "grid", gap: 6 }}>
      <FieldInput label="Name" value={name} onChange={setName} />
      <div style={{ display: "flex", gap: 12, fontSize: "0.8rem", color: "var(--text)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="radio" checked={personType === "child"} onChange={() => setPersonType("child")} /> Child
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="radio" checked={personType === "adult"} onChange={() => setPersonType("adult")} /> Adult
        </label>
      </div>
      <label style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>DOB (optional)</span>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={{ ...compactInputStyle, fontSize: "0.8rem" }} />
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={handleAdd}
          disabled={busy || !name.trim()}
          style={{
            minHeight: 32,
            padding: "0 14px",
            borderRadius: "var(--radius-pill)",
            border: "none",
            background: "var(--deep)",
            color: "var(--cream)",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          onClick={onDone}
          style={{ minHeight: 32, padding: "0 14px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={compactInputStyle} />
    </label>
  );
}

function DetailRow({ label, value, href, action }: { label: string; value: string; href?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <p style={{ fontSize: "0.85rem", color: "var(--text)", margin: 0, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ color: "var(--muted)" }}>{label}: </span>
        {href ? (
          <a href={href} style={{ color: "var(--warm)" }}>
            {value}
          </a>
        ) : (
          value
        )}
      </p>
      {action}
    </div>
  );
}

// Opens the address in whichever maps app the device actually treats as
// default — Apple Maps via universal link on iOS, Google Maps everywhere
// else (Android intent-handles this into its own app when installed).
// Computed at click time (not as a static href) so there's no server/client
// mismatch from reading navigator.userAgent during render.
function MapsLinkButton({ address }: { address: string }) {
  function handleClick() {
    const encoded = encodeURIComponent(address);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const href = isIOS ? `https://maps.apple.com/?q=${encoded}` : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    window.open(href, "_blank", "noopener,noreferrer");
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
