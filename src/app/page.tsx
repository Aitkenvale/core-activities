import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 16px",
        gap: 16,
      }}
    >
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", color: "var(--deep)" }}>
        Aitkenvale Program Tracker
      </h1>
      <p style={{ color: "var(--muted)", maxWidth: 420 }}>
        This app is for facilitators and admins. If you&rsquo;re a parent looking to register
        your children, please use the registration link or QR code shared with you.
      </p>
      <Link
        href="/app"
        style={{
          marginTop: 8,
          background: "var(--deep)",
          color: "var(--cream)",
          padding: "12px 28px",
          borderRadius: 2,
          fontSize: "0.85rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Facilitator / Admin Sign In
      </Link>
    </main>
  );
}
