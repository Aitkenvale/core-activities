export function Stub({ title }: { title: string }) {
  return (
    <>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--deep)", margin: "0 0 16px" }}>
        {title}
      </h2>
      <p style={{ color: "var(--muted)" }}>Coming in Phase 2.</p>
    </>
  );
}
