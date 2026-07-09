"use client";

import { useState } from "react";
import { updateUserRole, addAllowedSignup, removeAllowedSignup } from "./actions";
import { cardStyle, cardTitleStyle } from "./styles";

type ExistingUser = { id: string; name: string; email: string; role: string };
type PendingInvite = { id: string; name: string; email: string; isAdmin: boolean };

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  padding: "8px 0",
  borderBottom: "1px solid var(--border)",
};

const nameStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "0.85rem",
  color: "var(--text)",
};

const emailStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "0.78rem",
  color: "var(--muted)",
};

const inputStyle: React.CSSProperties = {
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

export function UsersCard({ initialUsers, initialInvites, currentUserId }: { initialUsers: ExistingUser[]; initialInvites: PendingInvite[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [invites, setInvites] = useState(initialInvites);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(u: ExistingUser) {
    if (u.id === currentUserId) return;
    const nextRole = u.role === "admin" ? "facilitator" : "admin";
    const previous = u.role;
    setUsers((rows) => rows.map((r) => (r.id === u.id ? { ...r, role: nextRole } : r)));
    setError(null);
    updateUserRole(u.id, nextRole).catch((e) => {
      setUsers((rows) => rows.map((r) => (r.id === u.id ? { ...r, role: previous } : r)));
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
    });
  }

  function handleRemoveInvite(id: string) {
    setInvites((rows) => rows.filter((r) => r.id !== id));
    removeAllowedSignup(id).catch((e) => {
      setError(e instanceof Error ? e.message : "Couldn't remove that invite.");
    });
  }

  return (
    <div style={cardStyle}>
      <h3 style={cardTitleStyle}>Users</h3>

      <h4 style={{ fontSize: "0.85rem", color: "var(--text)", marginBottom: 8 }}>Signed up</h4>
      <div style={{ marginBottom: "var(--space-5)" }}>
        {users.map((u) => (
          <div key={u.id} style={rowStyle}>
            <span style={nameStyle}>{u.name}</span>
            <span style={emailStyle}>{u.email}</span>
            <button
              onClick={() => toggleRole(u)}
              disabled={u.id === currentUserId}
              title={u.id === currentUserId ? "You can't change your own role" : undefined}
              style={{
                minHeight: 32,
                padding: "0 14px",
                borderRadius: "var(--radius-pill)",
                border: `1px solid ${u.role === "admin" ? "var(--deep)" : "var(--border)"}`,
                background: u.role === "admin" ? "var(--deep)" : "var(--card-bg)",
                color: u.role === "admin" ? "var(--cream)" : "var(--muted)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                cursor: u.id === currentUserId ? "default" : "pointer",
                opacity: u.id === currentUserId ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {u.role === "admin" ? "Admin" : "Facilitator"}
            </button>
          </div>
        ))}
        {users.length === 0 && <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>No one has signed up yet.</p>}
      </div>

      <h4 style={{ fontSize: "0.85rem", color: "var(--text)", marginBottom: 8 }}>Invited, not yet signed up</h4>
      <div>
        {invites.map((inv) => (
          <div key={inv.id} style={rowStyle}>
            <span style={nameStyle}>{inv.name}</span>
            <span style={emailStyle}>{inv.email}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {inv.isAdmin ? "Admin" : "Facilitator"}
            </span>
            <button
              onClick={() => handleRemoveInvite(inv.id)}
              title="Remove invite"
              style={{ minHeight: 32, padding: "0 10px", border: "none", background: "none", color: "var(--red)", fontSize: "0.75rem", cursor: "pointer" }}
            >
              Remove
            </button>
          </div>
        ))}
        {invites.length === 0 && <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 12 }}>No pending invites.</p>}
      </div>

      <AddInviteForm
        onAdded={(created) => setInvites((rows) => [...rows, created])}
        onError={(msg) => setError(msg)}
      />

      {error && <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: 8 }}>{error}</p>}
    </div>
  );
}

function AddInviteForm({ onAdded, onError }: { onAdded: (invite: PendingInvite) => void; onError: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      const created = await addAllowedSignup(name, email, isAdmin);
      onAdded(created);
      setName("");
      setEmail("");
      setIsAdmin(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't add that invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, width: 140 }} />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, width: 200 }} />
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem", color: "var(--text)" }}>
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
        Admin
      </label>
      <button
        onClick={handleAdd}
        disabled={busy || !name.trim() || !email.trim()}
        style={{
          minHeight: 36,
          padding: "0 16px",
          borderRadius: "var(--radius-pill)",
          border: "none",
          background: "var(--deep)",
          color: "var(--cream)",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
      >
        + Invite
      </button>
    </div>
  );
}
