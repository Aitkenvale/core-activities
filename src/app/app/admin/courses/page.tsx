import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { people } from "@/db/schema/people";
import { listAllStudyProgress } from "@/lib/studyProgress";
import { CourseGrid } from "./CourseGrid";

export default async function AdminCoursesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  // Everyone who isn't hidden (hidden = merged duplicates and the like, same
  // as every other list) — a course log can be filled in for anybody, not
  // just whoever is currently on an activity's roster.
  const [peopleRows, progress] = await Promise.all([
    db
      .select({ id: people.id, name: people.name, preferredName: people.preferredName, dob: people.dob })
      .from(people)
      .where(eq(people.hidden, false)),
    listAllStudyProgress(),
  ]);

  return <CourseGrid people={peopleRows} initialProgress={progress} />;
}
