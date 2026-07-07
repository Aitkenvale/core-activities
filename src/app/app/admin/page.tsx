import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

const VIEWS = [{ href: "/app/admin/people", label: "Edit All People" }];

export default async function AdminHome() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  return (
    <>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--deep)", margin: "0 0 20px" }}>
        Admin
      </h2>
      <div style={{ display: "grid", gap: 12, maxWidth: 320 }}>
        {VIEWS.map((v) => (
          <Link
            key={v.href}
            href={v.href}
            style={{
              display: "block",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: 20,
              fontSize: "0.95rem",
              color: "var(--text)",
            }}
          >
            {v.label}
          </Link>
        ))}
      </div>
    </>
  );
}
