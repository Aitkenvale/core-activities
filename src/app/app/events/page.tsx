import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { events } from "@/db/schema/events";
import { EventsList } from "./EventsList";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select().from(events).where(gte(events.date, today)).orderBy(asc(events.date));

  return <EventsList initialEvents={rows} />;
}
