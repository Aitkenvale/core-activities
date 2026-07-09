"use client";

import { usePathname } from "next/navigation";
import { isAdminWidePage } from "@/lib/adminWidePages";

// The phone-frame simulation makes sense for every facilitator-facing
// screen, but a real sortable/filterable spreadsheet (the admin data grids)
// needs full desktop width to be usable — exempt those.
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const exempt = isAdminWidePage(pathname);
  return <div className={exempt ? undefined : "phone-frame"}>{children}</div>;
}
