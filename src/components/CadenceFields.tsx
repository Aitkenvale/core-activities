"use client";

import { useEffect, useState } from "react";
import type { CadenceType, CadenceConfig, Occurrence } from "@/lib/cadence";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const OCCURRENCES: Occurrence[] = ["first", "second", "third", "fourth", "last"];
export const WEEKDAY_SHORT: Record<string, string> = {
  Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};

const inputStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  padding: "4px 6px",
  border: "1px solid var(--border)",
  borderRadius: 2,
  background: "var(--card-bg)",
  color: "var(--text)",
};

function computeConfig(
  type: CadenceType,
  weekdays: string[],
  intervalWeeks: number,
  intervalMonths: number,
  occurrences: { occurrence: Occurrence; weekday: string }[],
): CadenceConfig {
  if (type === "school_term" || type === "every_n_weeks") {
    return { weekdays, ...(type === "every_n_weeks" ? { intervalWeeks } : {}) };
  }
  if (type === "every_n_months") {
    return { intervalMonths, occurrences };
  }
  return {};
}

// Shared cadence-editing fields — used unwrapped inline (Create Activity)
// and inside a modal (admin Edit Activities' Cadence column), so the
// logic only lives once. Owns its own draft state and fires onChange with
// the recomputed (type, config) pair on every edit (including once on
// mount, to sync the parent to the seeded initial values); the caller
// decides whether that's applied live or held behind its own Save/Cancel.
export function CadenceFields({
  initialType,
  initialConfig,
  onChange,
}: {
  initialType: CadenceType;
  initialConfig: CadenceConfig;
  onChange: (type: CadenceType, config: CadenceConfig) => void;
}) {
  const [type, setType] = useState<CadenceType>(initialType);
  const [weekdays, setWeekdays] = useState<string[]>(initialConfig.weekdays ?? []);
  const [intervalWeeks, setIntervalWeeks] = useState(initialConfig.intervalWeeks ?? 1);
  const [intervalMonths, setIntervalMonths] = useState(initialConfig.intervalMonths ?? 1);
  const [occurrences, setOccurrences] = useState(initialConfig.occurrences ?? [{ occurrence: "first" as Occurrence, weekday: "Monday" }]);

  useEffect(() => {
    onChange(type, computeConfig(type, weekdays, intervalWeeks, intervalMonths, occurrences));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, weekdays, intervalWeeks, intervalMonths, occurrences]);

  function toggleWeekday(day: string) {
    setWeekdays((ws) => (ws.includes(day) ? ws.filter((w) => w !== day) : [...ws, day]));
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div style={{ display: "grid", gap: 6 }}>
        {(
          [
            ["school_term", "School Term (skips holidays)"],
            ["every_n_weeks", "Every N Weeks (use 1 for plain Weekly)"],
            ["every_n_months", "Every N Months"],
            ["ad_hoc", "Ad-hoc (no fixed pattern)"],
          ] as [CadenceType, string][]
        ).map(([value, label]) => (
          <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--text)", cursor: "pointer" }}>
            <input type="radio" name="cadenceType" checked={type === value} onChange={() => setType(value)} />
            {label}
          </label>
        ))}
      </div>

      {(type === "school_term" || type === "every_n_weeks") && (
        <div>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 6 }}>Meets on:</p>
          <WeekdayToggles selected={weekdays} onToggle={toggleWeekday} />
        </div>
      )}

      {type === "every_n_weeks" && (
        <label style={{ fontSize: "0.85rem", color: "var(--text)" }}>
          Repeat every
          <input
            type="number"
            min={1}
            value={intervalWeeks}
            onChange={(e) => setIntervalWeeks(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={{ ...inputStyle, width: 60, display: "inline-block", margin: "0 6px" }}
          />
          week(s)
        </label>
      )}

      {type === "every_n_months" && (
        <>
          <label style={{ fontSize: "0.85rem", color: "var(--text)" }}>
            Repeat every
            <input
              type="number"
              min={1}
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ ...inputStyle, width: 60, display: "inline-block", margin: "0 6px" }}
            />
            month(s), on:
          </label>
          <div style={{ display: "grid", gap: 6 }}>
            {occurrences.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select
                  value={o.occurrence}
                  onChange={(e) => setOccurrences((os) => os.map((x, j) => (j === i ? { ...x, occurrence: e.target.value as Occurrence } : x)))}
                  style={inputStyle}
                >
                  {OCCURRENCES.map((occ) => (
                    <option key={occ} value={occ}>
                      {occ}
                    </option>
                  ))}
                </select>
                <select
                  value={o.weekday}
                  onChange={(e) => setOccurrences((os) => os.map((x, j) => (j === i ? { ...x, weekday: e.target.value } : x)))}
                  style={inputStyle}
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setOccurrences((os) => os.filter((_, j) => j !== i))}
                  style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "1rem", padding: "0 4px" }}
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => setOccurrences((os) => [...os, { occurrence: "first", weekday: "Monday" }])}
              style={{ background: "none", border: "1px dashed var(--border)", borderRadius: 2, padding: "6px 10px", fontSize: "0.8rem", color: "var(--warm)", cursor: "pointer" }}
            >
              + Add occurrence
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function WeekdayToggles({ selected, onToggle }: { selected: string[]; onToggle: (day: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {WEEKDAYS.map((day) => (
        <button
          key={day}
          onClick={() => onToggle(day)}
          style={{
            padding: "6px 10px",
            borderRadius: 14,
            border: `1px solid ${selected.includes(day) ? "var(--deep)" : "var(--border)"}`,
            background: selected.includes(day) ? "var(--deep)" : "var(--card-bg)",
            color: selected.includes(day) ? "var(--cream)" : "var(--text)",
            fontSize: "0.78rem",
            cursor: "pointer",
          }}
        >
          {WEEKDAY_SHORT[day]}
        </button>
      ))}
    </div>
  );
}
