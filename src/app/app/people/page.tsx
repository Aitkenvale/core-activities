import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { PeopleSearch } from "./PeopleSearch";

export default async function PeoplePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isAdmin = session?.user?.role === "admin";

  return <PeopleSearch isAdmin={isAdmin} />;
}
