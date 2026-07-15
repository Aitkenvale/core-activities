import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoleManagementData } from "./actions";
import { RolesAdmin } from "./RolesAdmin";

export default async function RolesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const rows = await getRoleManagementData();
  return <RolesAdmin initialRows={rows} />;
}
