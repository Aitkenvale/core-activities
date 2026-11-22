// The Attendance session screen (/app/attendance/<category>/<activity>/session)
// draws its own header, with the activity's name as the title and the Close button,
// so the app's usual header (the app's name, a back area and the Close button)
// steps aside on this route only.
export function isAttendanceSessionPage(pathname: string): boolean {
  return /^\/app\/attendance\/[^/]+\/[^/]+\/session$/.test(pathname);
}
