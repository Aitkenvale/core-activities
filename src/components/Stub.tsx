export function Stub({ title }: { title: string }) {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px" }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", color: "var(--deep)", margin: "0 0 16px" }}>
        {title}
      </h1>
      <p style={{ color: "var(--muted)" }}>Coming in Phase 2.</p>
    </main>
  );
}
