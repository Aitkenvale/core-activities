"use client";

import { usePathname } from "next/navigation";

// The phone-frame simulation makes sense for every facilitator-facing
// screen, but a real sortable/filterable spreadsheet (the admin data grids)
// needs full desktop width to be usable — exempt those, but not the plain
// "/app/admin" menu page itself, which is just a normal mobile tile menu.
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const exempt = pathname.startsWith("/app/admin/");
  return <div className={exempt ? undefined : "phone-frame"}>{children}</div>;
}
