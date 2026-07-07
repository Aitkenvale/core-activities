"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setAttendance, searchPeople, enrollExistingPerson, quickAddPerson } from "./actions";

type RosterRow = {
  personId: string;
  name: string;
  preferredName: string | null;
  linkStatus: "linked" | "pending";
  role: "participant" | "facilitator";
};

type Status = "present" | "absent" | undefined;

export function SessionClient({
  categoryId,
  activityInstanceId,
  activityName,
  selectedDate,
  recentDates,
  roster,
  statusByPersonId,
}: {
  categoryId: string;
  activityInstanceId: string;
  activityName: string;
  selectedDate: string;
  recentDates: string[];
  roster: RosterRow[];
  statusByPersonId: Record<string, Status>;
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, Status>>(statusByPersonId);
  const [pending, startTransition] = useTransition();

  function goToDate(date: string) {
    router.push(`/app/attendance/${categoryId}/${activityInstanceId}/session?date=${date}`);
  }

  function toggle(personId: string, next: Status) {
    setStatuses((s) => ({ ...s, [personId]: next }));
    if (next) startTransition(() => setAttendance(activityInstanceId, selectedDate, personId, next));
  }

  const participants = roster.filter((r) => r.role === "participant");
  const facilitators = roster.filter((r) => r.role === "facilitator");

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
      <Link href={`/app/attendance/${categoryId}`} style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
        ← Back
      </Link>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--deep)", margin: "16px 0 4px" }}>
        {activityName}
      </h1>

      <DatePicker selectedDate={selectedDate} recentDates={recentDates} onPick={goToDate} />

      <RosterSection
        title="Participants"
        rows={participants}
        statuses={statuses}
        onToggle={toggle}
        activityInstanceId={activityInstanceId}
        role="participant"
        onChanged={() => router.refresh()}
      />
      <RosterSection
        title="Facilitators"
        rows={facilitators}
        statuses={statuses}
        onToggle={toggle}
        activityInstanceId={activityInstanceId}
        role="facilitator"
        onChanged={() => router.refresh()}
      />

      {pending && <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: 12 }}>Saving…</p>}
    </main>
  );
}

function DatePicker({
  selectedDate,
  recentDates,
  onPick,
}: {
  selectedDate: string;
  recentDates: string[];
  onPick: (date: string) => void;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
        {recentDates.map((d) => (
          <button
            key={d}
            onClick={() => onPick(d)}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 20,
              border: "1px solid var(--border)",
              background: d === selectedDate ? "var(--deep)" : "#fff",
              color: d === selectedDate ? "var(--cream)" : "var(--text)",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            {formatShort(d)}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          Or pick another date:{" "}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && onPick(e.target.value)}
            style={{ fontSize: "0.85rem", padding: 4 }}
          />
        </label>
      </div>
    </div>
  );
}

function formatShort(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function RosterSection({
  title,
  rows,
  statuses,
  onToggle,
  activityInstanceId,
  role,
  onChanged,
}: {
  title: string;
  rows: RosterRow[];
  statuses: Record<string, Status>;
  onToggle: (personId: string, status: Status) => void;
  activityInstanceId: string;
  role: "participant" | "facilitator";
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
        {title}
      </h2>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <div
            key={r.personId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "10px 14px",
            }}
          >
            <span style={{ fontSize: "0.9rem" }}>
              {r.preferredName || r.name}
              {r.linkStatus === "pending" && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: "0.65rem",
                    color: "var(--warm)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "1px 6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Not linked
                </span>
              )}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => onToggle(r.personId, "present")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 2,
                  border: "1px solid var(--green)",
                  background: statuses[r.personId] === "present" ? "var(--green)" : "#fff",
                  color: statuses[r.personId] === "present" ? "#fff" : "var(--green)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Present
              </button>
              <button
                onClick={() => onToggle(r.personId, "absent")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 2,
                  border: "1px solid var(--red)",
                  background: statuses[r.personId] === "absent" ? "var(--red)" : "#fff",
                  color: statuses[r.personId] === "absent" ? "#fff" : "var(--red)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Absent
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <AddPersonForm
          activityInstanceId={activityInstanceId}
          role={role}
          onDone={() => {
            setAdding(false);
            onChanged();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            marginTop: 8,
            width: "100%",
            background: "none",
            border: "1px dashed var(--border)",
            borderRadius: 3,
            padding: 10,
            fontSize: "0.8rem",
            color: "var(--warm)",
            cursor: "pointer",
          }}
        >
          + Add New {role === "participant" ? "Participant" : "Facilitator"}
        </button>
      )}
    </section>
  );
}

type SearchResult = { id: string; name: string; preferredName: string | null; linkStatus: "linked" | "pending" };

function AddPersonForm({
  activityInstanceId,
  role,
  onDone,
  onCancel,
}: {
  activityInstanceId: string;
  role: "participant" | "facilitator";
  onDone: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const r = await searchPeople(value);
    setResults(r);
  }

  async function handleCreateNew() {
    if (!query.trim()) return;
    setBusy(true);
    await quickAddPerson(activityInstanceId, query.trim(), role);
    setBusy(false);
    onDone();
  }

  async function handlePick(personId: string) {
    setBusy(true);
    await enrollExistingPerson(activityInstanceId, personId, role);
    setBusy(false);
    onDone();
  }

  return (
    <div style={{ marginTop: 8, background: "#fff", border: "1px solid var(--border)", borderRadius: 4, padding: 12 }}>
      <input
        autoFocus
        placeholder="Type a name…"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", fontSize: 16, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 2 }}
      />
      <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
        <button
          onClick={handleCreateNew}
          disabled={busy || !query.trim()}
          style={{
            textAlign: "left",
            padding: "8px 10px",
            borderRadius: 2,
            border: "1px dashed var(--gold)",
            background: "var(--cream2)",
            color: "var(--warm)",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          + Create new{query.trim() ? `: "${query.trim()}"` : "…"}
        </button>
        {results.map((r) => (
          <button
            key={r.id}
            onClick={() => handlePick(r.id)}
            disabled={busy}
            style={{
              textAlign: "left",
              padding: "8px 10px",
              borderRadius: 2,
              border: "1px solid var(--border)",
              background: "#fff",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {r.preferredName || r.name}
            {r.linkStatus === "pending" && <span style={{ color: "var(--muted)" }}> (not linked)</span>}
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        style={{ marginTop: 8, background: "none", border: "none", color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer" }}
      >
        Cancel
      </button>
    </div>
  );
}
