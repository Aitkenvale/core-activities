"use client";

import { useState } from "react";
import { createHousehold, searchHouseholds, addHouseholdMember, saveHouseholdContact } from "./actions";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { compactInputStyle, FieldInput, inferPersonType } from "./PeopleSearch";

type HouseholdOption = { id: string; name: string };

// Two ways in — start a brand-new household, or find one that already
// exists — that both land on the same "keep adding people" loop, since
// from that point on the two flows are identical. Each person is created
// immediately on "+ Add Person" (not batched into one big submit), so nothing
// already added is lost if this gets closed partway through.
export function AddPeopleModal({ onClose, onDone }: { onClose: () => void; onDone: (householdName: string) => void }) {
  const [household, setHousehold] = useState<HouseholdOption | null>(null);
  const [addedNames, setAddedNames] = useState<string[]>([]);

  if (!household) {
    return (
      <HouseholdStep onClose={onClose} onHousehold={setHousehold} />
    );
  }

  return (
    <ModalCard title={`Add People — ${household.name}`} onClose={onClose}>
      <AddPersonForm householdId={household.id} onAdded={(name) => setAddedNames((n) => [...n, name])} />
      {addedNames.length > 0 && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <p style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>
            Added this session
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.85rem", color: "var(--text)" }}>
            {addedNames.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={() => onDone(household.name)} style={{ ...primaryButtonStyle, marginTop: "var(--space-4)", width: "100%" }}>
        Done
      </button>
    </ModalCard>
  );
}

function HouseholdStep({
  onClose,
  onHousehold,
}: {
  onClose: () => void;
  onHousehold: (h: HouseholdOption) => void;
}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HouseholdOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      onHousehold(await createHousehold(trimmed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that household.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSearch(value: string) {
    setSearchQuery(value);
    setSearchResults(value.trim() ? await searchHouseholds(value) : []);
  }

  return (
    <ModalCard title="Add People" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: "var(--space-4)" }}>
        <TabButton active={mode === "new"} onClick={() => setMode("new")}>
          New Household
        </TabButton>
        <TabButton active={mode === "existing"} onClick={() => setMode("existing")}>
          Existing Household
        </TabButton>
      </div>

      {mode === "new" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <FieldInput label="Household name" value={newName} onChange={setNewName} />
          <button onClick={handleCreate} disabled={creating || !newName.trim()} style={primaryButtonStyle}>
            {creating ? "Creating…" : "Create & Continue"}
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          <input
            placeholder="Search households…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={compactInputStyle}
          />
          {searchResults.map((h) => (
            <button key={h.id} onClick={() => onHousehold(h)} style={resultButtonStyle}>
              {h.name}
            </button>
          ))}
          {searchQuery.trim() && searchResults.length === 0 && (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>No matching households.</p>
          )}
        </div>
      )}
      {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: 8 }}>{error}</p>}
    </ModalCard>
  );
}

function AddPersonForm({ householdId, onAdded }: { householdId: string; onAdded: (name: string) => void }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [makeContact, setMakeContact] = useState(false);
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const created = await addHouseholdMember(householdId, trimmed, inferPersonType(dob), dob || null);
      if (makeContact) {
        await saveHouseholdContact(householdId, created.id, mobile.trim() || null);
      }
      onAdded(trimmed);
      setName("");
      setDob("");
      setMakeContact(false);
      setMobile("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that person.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <FieldInput label="Name" value={name} onChange={setName} />
      <label style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>DOB (optional)</span>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={{ ...compactInputStyle, textAlign: "left", minWidth: 0 }} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--text)", cursor: "pointer" }}>
        <input type="checkbox" checked={makeContact} onChange={(e) => setMakeContact(e.target.checked)} />
        Make this person the household contact
      </label>
      {makeContact && <FieldInput label="Mobile" value={mobile} onChange={setMobile} />}
      <button onClick={handleAdd} disabled={busy || !name.trim()} style={primaryButtonStyle}>
        {busy ? "Adding…" : "+ Add Person"}
      </button>
      {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", margin: 0 }}>{error}</p>}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minHeight: 36,
        border: `1px solid ${active ? "var(--deep)" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        background: active ? "var(--deep)" : "var(--card-bg)",
        color: active ? "var(--cream)" : "var(--muted)",
        fontSize: "0.8rem",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ModalCard({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(90vw, 380px)",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "var(--card-bg)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated)",
          padding: "var(--space-5)",
        }}
      >
        <ModalCloseButton onClick={onClose} />
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: "var(--heading)", marginBottom: "var(--space-4)", paddingRight: 28 }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 36,
  padding: "0 16px",
  borderRadius: "var(--radius-pill)",
  border: "none",
  background: "var(--deep)",
  color: "var(--cream)",
  fontSize: "0.82rem",
  cursor: "pointer",
};

const resultButtonStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--text)",
  fontSize: "0.85rem",
  cursor: "pointer",
};
