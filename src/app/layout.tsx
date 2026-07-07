import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aitkenvale Core Activities",
  description: "Attendance, activities and people tracker for the Aitkenvale Bahá'í community programs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="phone-frame">{children}</div>
      </body>
    </html>
  );
}
