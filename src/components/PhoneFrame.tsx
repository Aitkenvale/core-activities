"use client";

import { usePathname } from "next/navigation";

// The phone-frame simulation makes sense for every facilitator-facing
// screen, but a real sortable/filterable spreadsheet (admin section) needs
// full desktop width to be usable — exempt it rather than cram a data grid
// into a 430px column.
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const exempt = pathname.startsWith("/app/admin");
  return <div className={exempt ? undefined : "phone-frame"}>{children}</div>;
}
