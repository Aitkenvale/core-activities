import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function QrPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const host = (await headers()).get("host") ?? "aitkenvale-core-activities.vercel.app";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const registerUrl = `${protocol}://${host}/register`;
  // Same free, no-signup QR generator the old qr.html used — no new
  // service/account needed at zero budget.
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&ecc=H&data=${encodeURIComponent(registerUrl)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 18, color: "var(--gold)", letterSpacing: 5, opacity: 0.8, marginBottom: 22 }}>✦ ✦ ✦</div>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.6rem", fontWeight: 600, lineHeight: 1.2, color: "var(--heading)", marginBottom: 8 }}>
        Junior Youth Spiritual
        <br />
        Empowerment Programme
      </h2>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "var(--gold)", fontSize: "1.1rem", margin: "4px 0" }}>&amp;</p>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.6rem", fontWeight: 600, color: "var(--heading)", marginBottom: 24 }}>Children&rsquo;s Classes</h2>
      <div style={{ width: 48, height: 1, background: "var(--gold)", margin: "0 auto 24px" }} />
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: 18, marginBottom: 20 }}>
        <img src={qrImageUrl} alt="QR code — scan to register" width={280} height={280} style={{ display: "block", imageRendering: "pixelated" }} />
      </div>
      <p style={{ fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>Scan to register your children</p>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 24, wordBreak: "break-all" }}>{registerUrl}</p>
    </div>
  );
}
