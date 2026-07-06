import Link from "next/link";

export function Stub({ title }: { title: string }) {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
      <Link href="/app" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
        ← Back
      </Link>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", color: "var(--deep)", margin: "16px 0" }}>
        {title}
      </h1>
      <p style={{ color: "var(--muted)" }}>Coming in Phase 2.</p>
    </main>
  );
}
