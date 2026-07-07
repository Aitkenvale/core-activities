"use client";

import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";

// Sign out only shows on the top-level hub (L1) — deeper menu levels don't
// repeat it.
export function ConditionalSignOut() {
  const pathname = usePathname();
  if (pathname !== "/app") return null;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32 }}>
      <SignOutButton />
    </div>
  );
}
