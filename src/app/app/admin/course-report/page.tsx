import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listAllStudyProgress, listPeopleWithStudyProgress } from "@/lib/studyProgress";
import { CourseReport } from "./CourseReport";

export default async function CourseReportPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") redirect("/app");

  const [people, allProgress] = await Promise.all([listPeopleWithStudyProgress(), listAllStudyProgress()]);
  // Hidden people (merged duplicates and the like) have no row in the report,
  // so their boxes aren't sent either.
  const listed = new Set(people.map((p) => p.id));
  const progress = allProgress.filter((r) => listed.has(r.personId));

  return <CourseReport people={people} progress={progress} />;
}
