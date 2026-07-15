"use client";

import { useEffect, useRef, useState } from "react";
import {
  searchPeopleDirectory,
  updatePersonName,
  updatePersonPreferredName,
  updatePersonMobile,
  updatePersonRegoYear,
  updatePersonDob,
  updatePersonNotes,
  updateHouseholdAddress,
  addHouseholdMember,
  searchHouseholds,
  createHousehold,
  assignHousehold,
  setHouseholdContact,
  searchPeopleForContact,
  createContactPerson,
  saveHouseholdContact,
} from "./actions";
import { formatFullName } from "@/lib/formatName";
import { calculateAge } from "@/lib/category";

type Result = {
  id: string;
  name: string;
  preferredName: string | null;
  householdId: string | null;
  householdName: string | null;
  householdAddress: string | null;
  householdContactPersonId: string | null;
  householdContactName: string | null;
  householdContactPreferredName: string | null;
  householdContactMobile: string | null;
  mobile: string | null;
  regoYear: number | null;
  dob: string | null;
  comment: string | null;
  activities: string[];
};

// Rego is only relevant under 18 — 18+ participants don't register per-year.
function isRegoEligible(dob: string | null): boolean {
  return !dob || calculateAge(dob) < 18;
}

// Under-12s don't carry their own personal mobile — that field is for the
// household contact's number instead.
function isMobileEligible(dob: string | null): boolean {
  return !dob || calculateAge(dob) >= 12;
}

// How long to wait after the last change before auto-saving.
const AUTOSAVE_DELAY_MS = 700;

// fontSize must be >= 16px — anything smaller makes iOS Safari auto-zoom the
// whole page on focus, and it doesn't reliably zoom back out on blur.
const compactInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 16,
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
        style={{ ...compactInputStyle, minHeight: "var(--tap-min)", marginTop: "var(--space-2)" }}
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
      <DetailRow label="Name" value={result.name} />
      <DetailRow label="AKA" value={result.preferredName ?? "—"} />
      <DetailRow label="DOB" value={result.dob ?? "—"} />
      {isMobileEligible(result.dob) && (
        <DetailRow label="Mobile" value={result.mobile ?? "—"} href={result.mobile ? `tel:${result.mobile}` : undefined} />
      )}
      {isRegoEligible(result.dob) && <DetailRow label="Rego" value={result.regoYear ? String(result.regoYear) : "—"} />}
      <DetailRow label="Household" value={result.householdName ?? "—"} />
      <DetailRow
        label="Address"
        value={result.householdAddress ?? "—"}
        action={result.householdAddress ? <MapsLinkButton address={result.householdAddress} /> : undefined}
      />
      <DetailRow
        label="Contact"
        value={
          result.householdContactName
            ? `${result.householdContactName}${result.householdContactPreferredName ? ` (${result.householdContactPreferredName})` : ""} — ${result.householdContactMobile ?? "—"}`
            : "—"
        }
        href={result.householdContactMobile ? `tel:${result.householdContactMobile}` : undefined}
      />
      {result.comment && <DetailRow label="Notes" value={result.comment} />}
      <DetailRow label="Activities" value={result.activities.length ? result.activities.join(", ") : "—"} />
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
  const [name, setName] = useState(result.name);
  const [preferredName, setPreferredName] = useState(result.preferredName ?? "");
  const [mobile, setMobile] = useState(result.mobile ?? "");
  const [dob, setDob] = useState(result.dob ?? "");
  const [regoYear, setRegoYear] = useState(result.regoYear !== null ? String(result.regoYear) : "");
  const [householdId, setHouseholdId] = useState(result.householdId);
  const [householdQuery, setHouseholdQuery] = useState(result.householdName ?? "");
  const [householdResults, setHouseholdResults] = useState<{ id: string; name: string }[]>([]);
  // Only asked right after this exact form creates a brand-new household —
  // an existing household's contact is a separate decision, changed
  // elsewhere (Edit Households), not implied by just moving someone into it.
  const [contactPrompt, setContactPrompt] = useState<{ householdId: string; householdName: string } | null>(null);
  const [address, setAddress] = useState(result.householdAddress ?? "");
  const [contactPersonId, setContactPersonId] = useState(result.householdContactPersonId);
  const [contactQuery, setContactQuery] = useState(result.householdContactPreferredName || result.householdContactName || "");
  const [contactResults, setContactResults] = useState<{ id: string; name: string; preferredName: string | null; mobile: string | null }[]>([]);
  const [contactMobile, setContactMobile] = useState(result.householdContactMobile ?? "");
  const [notes, setNotes] = useState(result.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  // Frozen snapshot of every field as this form opened — used both to diff
  // "did this actually change" for auto-save, and by Cancel to revert.
  // Deliberately NOT the live `result` prop, since onChange (called after
  // every auto-save) patches the parent's copy of it — comparing against a
  // moving target would make both the diff and the revert wrong.
  const originalRef = useRef(result);
  // A newly selected/created household's real address and contact aren't
  // known client-side (selectHousehold/handleCreateHousehold reset those
  // fields to blank) — diffing them against the person's *original*
  // household would immediately auto-save blanks over that other
  // household's real, already-populated data. This tracks the right
  // baseline to diff against once the household itself has changed.
  const householdBaselineRef = useRef({
    householdId: result.householdId,
    address: result.householdAddress ?? "",
    contactPersonId: result.householdContactPersonId,
    contactMobile: result.householdContactMobile ?? "",
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleHouseholdSearch(value: string) {
    setHouseholdQuery(value);
    setHouseholdId(null);
    setHouseholdResults(value.trim() ? await searchHouseholds(value) : []);
  }

  function selectHousehold(h: { id: string; name: string }) {
    setHouseholdId(h.id);
    setHouseholdQuery(h.name);
    setHouseholdResults([]);
    // A different household's address/contact aren't known client-side.
    setAddress("");
    setContactPersonId(null);
    setContactQuery("");
    setContactResults([]);
    setContactMobile("");
    householdBaselineRef.current = { householdId: h.id, address: "", contactPersonId: null, contactMobile: "" };
  }

  async function handleCreateHousehold() {
    const trimmed = householdQuery.trim();
    if (!trimmed) return;
    try {
      const created = await createHousehold(trimmed);
      setHouseholdId(created.id);
      setHouseholdQuery(created.name);
      setHouseholdResults([]);
      setAddress("");
      setContactPersonId(null);
      setContactQuery("");
      setContactResults([]);
      setContactMobile("");
      setContactPrompt({ householdId: created.id, householdName: created.name });
      householdBaselineRef.current = { householdId: created.id, address: "", contactPersonId: null, contactMobile: "" };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that household.");
    }
  }

  function removeHousehold() {
    setHouseholdId(null);
    setHouseholdQuery("");
    setHouseholdResults([]);
    setAddress("");
    setContactPersonId(null);
    setContactQuery("");
    setContactResults([]);
    setContactMobile("");
    setContactPrompt(null);
    householdBaselineRef.current = { householdId: null, address: "", contactPersonId: null, contactMobile: "" };
  }

  async function answerContactPrompt(makeContact: boolean) {
    if (!contactPrompt) return;
    if (makeContact) {
      try {
        await setHouseholdContact(contactPrompt.householdId, result.id);
        setContactPersonId(result.id);
        setContactQuery(formatFullName(name, preferredName));
        setContactMobile(mobile);
        householdBaselineRef.current = { ...householdBaselineRef.current, contactPersonId: result.id, contactMobile: mobile };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't set that contact.");
      }
    }
    setContactPrompt(null);
  }

  async function handleContactSearch(value: string) {
    setContactQuery(value);
    setContactPersonId(null);
    setContactResults(await searchPeopleForContact(value));
  }

  function selectContact(p: { id: string; name: string; preferredName: string | null; mobile: string | null }) {
    setContactPersonId(p.id);
    setContactQuery(p.preferredName || p.name);
    setContactResults([]);
    setContactMobile(p.mobile ?? "");
  }

  function removeContact() {
    setContactPersonId(null);
    setContactQuery("");
    setContactResults([]);
    setContactMobile("");
  }

  async function handleCreateContact() {
    const trimmed = contactQuery.trim();
    if (!trimmed) return;
    try {
      const created = await createContactPerson(trimmed);
      setContactPersonId(created.id);
      setContactQuery(created.preferredName || created.name);
      setContactResults([]);
      setContactMobile(""); // a brand-new person has no mobile yet
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that contact.");
    }
  }

  // The auto-save itself — diffs current state against the frozen original
  // (or, for address/contact on a freshly switched household, against that
  // household's own blank baseline — see householdBaselineRef above) and
  // only sends what actually changed.
  async function persist() {
    const tasks: Promise<unknown>[] = [];
    if (name.trim() && name !== originalRef.current.name) tasks.push(updatePersonName(result.id, name));
    if (preferredName !== (originalRef.current.preferredName ?? "")) tasks.push(updatePersonPreferredName(result.id, preferredName));
    if (mobile !== (originalRef.current.mobile ?? "")) tasks.push(updatePersonMobile(result.id, mobile));
    if (dob !== (originalRef.current.dob ?? "")) tasks.push(updatePersonDob(result.id, dob || null));
    const regoYearNum = regoYear.trim() ? parseInt(regoYear, 10) : null;
    if (regoYearNum !== originalRef.current.regoYear) tasks.push(updatePersonRegoYear(result.id, regoYearNum));
    if (householdId !== originalRef.current.householdId) tasks.push(assignHousehold(result.id, householdId));
    const onOriginalHousehold = householdId === originalRef.current.householdId;
    const addressBaseline = onOriginalHousehold ? (originalRef.current.householdAddress ?? "") : householdBaselineRef.current.address;
    if (householdId && address !== addressBaseline) tasks.push(updateHouseholdAddress(householdId, address));
    const contactIdBaseline = onOriginalHousehold ? originalRef.current.householdContactPersonId : householdBaselineRef.current.contactPersonId;
    const contactMobileBaseline = onOriginalHousehold ? (originalRef.current.householdContactMobile ?? "") : householdBaselineRef.current.contactMobile;
    if (householdId && (contactPersonId !== contactIdBaseline || contactMobile !== contactMobileBaseline)) {
      tasks.push(saveHouseholdContact(householdId, contactPersonId, contactMobile || null));
    }
    if (notes !== (originalRef.current.comment ?? "")) tasks.push(updatePersonNotes(result.id, notes));
    if (tasks.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      await Promise.all(tasks);
      onChange({
        name: name.trim() || originalRef.current.name,
        preferredName: preferredName.trim() || null,
        mobile: mobile.trim() || null,
        dob: dob || null,
        regoYear: regoYearNum,
        householdId,
        householdName: householdId ? householdQuery : null,
        householdAddress: householdId ? address.trim() || null : null,
        householdContactPersonId: householdId ? contactPersonId : null,
        householdContactName: householdId && contactPersonId ? contactQuery : null,
        householdContactPreferredName: null,
        householdContactMobile: householdId && contactPersonId ? contactMobile.trim() || null : null,
        comment: notes.trim() || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    saveTimer.current = setTimeout(() => {
      persist();
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, preferredName, mobile, dob, regoYear, householdId, address, contactPersonId, contactMobile, notes]);

  // The relabeled former Save button — auto-save already did the work, this
  // just flushes anything still mid-debounce and closes.
  async function handleFinish() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await persist();
    onDone();
  }

  // Undoes whatever auto-save already persisted for this person and their
  // *original* household this session, then closes. If the admin also
  // browsed into a different household and edited its address/contact
  // before cancelling, that other household's data isn't reverted here —
  // it's a real, independent record, not something scoped to this session.
  async function handleCancel() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setCancelling(true);
    try {
      const tasks: Promise<unknown>[] = [
        updatePersonName(result.id, originalRef.current.name),
        updatePersonPreferredName(result.id, originalRef.current.preferredName ?? ""),
        updatePersonMobile(result.id, originalRef.current.mobile ?? ""),
        updatePersonDob(result.id, originalRef.current.dob),
        updatePersonRegoYear(result.id, originalRef.current.regoYear),
        assignHousehold(result.id, originalRef.current.householdId),
        updatePersonNotes(result.id, originalRef.current.comment ?? ""),
      ];
      if (originalRef.current.householdId) {
        tasks.push(updateHouseholdAddress(originalRef.current.householdId, originalRef.current.householdAddress ?? ""));
        tasks.push(
          saveHouseholdContact(
            originalRef.current.householdId,
            originalRef.current.householdContactPersonId,
            originalRef.current.householdContactMobile ?? null,
          ),
        );
      }
      await Promise.all(tasks);
      onChange(originalRef.current);
    } catch {
      // Best-effort revert — still close either way.
    } finally {
      setCancelling(false);
    }
    onDone();
  }

  return (
    <div style={{ padding: "0 var(--space-3) var(--space-3)", display: "grid", gap: 6 }}>
      <FieldInput label="Name" value={name} onChange={setName} />
      <FieldInput label="AKA" value={preferredName} onChange={setPreferredName} />
      <label style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>DOB</span>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={{ ...compactInputStyle, textAlign: "left", minWidth: 0 }} />
      </label>
      {isMobileEligible(dob) && <FieldInput label="Mobile" value={mobile} onChange={setMobile} />}
      {isRegoEligible(dob) && (
        <label style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Rego</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={regoYear}
            onChange={(e) => setRegoYear(e.target.value.replace(/\D/g, ""))}
            style={compactInputStyle}
          />
        </label>
      )}
      <label style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Household</span>
        <input
          placeholder="Search household…"
          value={householdQuery}
          onChange={(e) => handleHouseholdSearch(e.target.value)}
          style={compactInputStyle}
        />
        {householdQuery.trim() && householdId === null && (
          <button
            onClick={handleCreateHousehold}
            style={{
              marginTop: 2,
              textAlign: "left",
              padding: "6px 8px",
              border: "1px dashed var(--gold)",
              borderRadius: "var(--radius-sm)",
              background: "var(--cream2)",
              color: "var(--heading)",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            + Create new household: &ldquo;{householdQuery.trim()}&rdquo;
          </button>
        )}
        {householdResults.length > 0 && (
          <div style={{ display: "grid", gap: 2 }}>
            {householdResults.map((h) => (
              <button
                key={h.id}
                onClick={() => selectHousehold(h)}
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--card-bg)",
                  color: "var(--text)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                {h.name}
              </button>
            ))}
          </div>
        )}
        {(householdId || householdQuery.trim()) && (
          <button
            onClick={removeHousehold}
            style={{ justifySelf: "start", padding: 0, border: "none", background: "none", color: "var(--red)", fontSize: "0.7rem", cursor: "pointer" }}
          >
            Remove household
          </button>
        )}
      </label>
      {contactPrompt && (
        <div style={{ padding: "var(--space-2)", border: "1px dashed var(--gold)", borderRadius: "var(--radius-sm)", background: "var(--cream2)" }}>
          <p style={{ fontSize: "0.78rem", color: "var(--text)", margin: "0 0 6px" }}>
            Make {formatFullName(name, result.preferredName)} the contact for &ldquo;{contactPrompt.householdName}&rdquo;?
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => answerContactPrompt(true)}
              style={{ minHeight: 28, padding: "0 12px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--deep)", color: "var(--cream)", fontSize: "0.72rem", cursor: "pointer" }}
            >
              Yes
            </button>
            <button
              onClick={() => answerContactPrompt(false)}
              style={{ minHeight: 28, padding: "0 12px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.72rem", cursor: "pointer" }}
            >
              No
            </button>
          </div>
        </div>
      )}
      {householdId ? (
        <FieldInput label="Address" value={address} onChange={setAddress} />
      ) : (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>No household on file — address can&rsquo;t be set.</p>
      )}
      {householdId && (
        <label style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Contact</span>
          <input
            placeholder="Search person…"
            value={contactQuery}
            onChange={(e) => handleContactSearch(e.target.value)}
            style={compactInputStyle}
          />
          {contactQuery.trim() && contactPersonId === null && (
            <button
              onClick={handleCreateContact}
              style={{
                marginTop: 2,
                textAlign: "left",
                padding: "6px 8px",
                border: "1px dashed var(--gold)",
                borderRadius: "var(--radius-sm)",
                background: "var(--cream2)",
                color: "var(--heading)",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              + Create new contact: &ldquo;{contactQuery.trim()}&rdquo;
            </button>
          )}
          {contactResults.length > 0 && (
            <div style={{ display: "grid", gap: 2 }}>
              {contactResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectContact(p)}
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--card-bg)",
                    color: "var(--text)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  {p.preferredName || p.name}
                </button>
              ))}
            </div>
          )}
          {(contactPersonId || contactQuery.trim()) && (
            <button
              onClick={removeContact}
              style={{ justifySelf: "start", padding: 0, border: "none", background: "none", color: "var(--red)", fontSize: "0.7rem", cursor: "pointer" }}
            >
              Remove contact
            </button>
          )}
        </label>
      )}
      {householdId && <FieldInput label="Contact's Mobile" value={contactMobile} onChange={setContactMobile} />}
      <FieldInput label="Notes" value={notes} onChange={setNotes} />

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={handleFinish}
          disabled={saving || cancelling}
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
          {saving ? "Saving…" : "Auto-Save"}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving || cancelling}
          style={{ minHeight: 32, padding: "0 14px", border: "none", background: "none", color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer" }}
        >
          {cancelling ? "Undoing…" : "Cancel"}
        </button>
        {result.householdId && !addingMember && (
          <button
            onClick={() => setAddingMember(true)}
            style={{
              marginLeft: "auto",
              minHeight: 32,
              padding: "0 12px",
              border: "1px dashed var(--gold)",
              borderRadius: "var(--radius-sm)",
              background: "none",
              color: "var(--heading)",
              fontSize: "0.75rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Add household member
          </button>
        )}
      </div>
      {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", margin: 0 }}>{error}</p>}

      {result.householdId && addingMember && (
        <AddHouseholdMemberForm householdId={result.householdId} onDone={() => setAddingMember(false)} />
      )}
    </div>
  );
}

// Child vs adult isn't asked for — it's inferred from DOB (under 18 =
// child), same as the rest of the app never storing an age-derived value.
// No DOB yet (a newborn whose exact date isn't entered) defaults to child,
// since that's this form's main use case.
function inferPersonType(dob: string): "child" | "adult" {
  if (!dob) return "child";
  return calculateAge(dob) >= 18 ? "adult" : "child";
}

function AddHouseholdMemberForm({ householdId, onDone }: { householdId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addHouseholdMember(householdId, name, inferPersonType(dob), dob || null);
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
      <label style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>DOB (optional)</span>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={{ ...compactInputStyle, textAlign: "left", minWidth: 0 }} />
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
          <a href={href} style={{ color: "var(--text)" }}>
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
//
// Same-tab navigation (not window.open/_blank) is deliberate — iOS
// intercepts the universal link and hands off to the Maps app before this
// tab actually navigates away, so the original page is still sitting right
// there underneath. A new tab instead leaves behind a genuinely blank tab
// with nothing ever loaded into it, which is what showed up as a black
// screen after returning from Maps — Safari's "back to <site>" link goes
// to that empty tab, not the app, so getting back needs closing the tab.
function MapsLinkButton({ address }: { address: string }) {
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
