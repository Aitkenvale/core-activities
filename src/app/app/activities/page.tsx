import Link from "next/link";

const tileStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: "var(--tap-min)",
  background: "var(--card-bg)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-card)",
  padding: "var(--space-5)",
  fontSize: "1.05rem",
  color: "var(--text)",
};

export default function ActivitiesHomePage() {
  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <Link href="/app/activities/edit" style={tileStyle}>
        Edit Activity
      </Link>
      <Link href="/app/activities/create" style={tileStyle}>
        Create Activity
      </Link>
    </div>
  );
}
