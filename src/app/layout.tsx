import type { Metadata } from "next";
import { PhoneFrame } from "@/components/PhoneFrame";
import { getEnforceDarkMode } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aitkenvale",
  description: "Attendance, activities and people tracker for the Aitkenvale Bahá'í community programs",
};

// Without this, pages with no other dynamic API (the public /register,
// /sign-in, /sign-up, and a few /app pages that don't read the session)
// get statically generated at build time — baking in whatever
// getEnforceDarkMode() returned *then* and never re-checking it, so toggling
// the setting in Settings > Appearance wouldn't visibly do anything until
// the next deploy. Forcing every request through the server keeps it live.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const enforceDarkMode = await getEnforceDarkMode();
  return (
    <html lang="en" data-theme={enforceDarkMode ? "dark" : undefined}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PhoneFrame>{children}</PhoneFrame>
      </body>
    </html>
  );
}
