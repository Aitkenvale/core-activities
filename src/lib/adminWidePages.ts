// Every admin route — including the bare "/app/admin" L2 tile menu itself
// — is edited on a computer and gets full desktop width plus the plain
// admin tab bar (no outer mobile header). Matching the whole /app/admin
// prefix instead of a curated per-page list means a newly added admin
// page is wide by default, not narrow-by-omission (this list previously
// missed a couple of new report pages simply because nobody remembered
// to add them here).
export function isAdminWidePage(pathname: string): boolean {
  return pathname.startsWith("/app/admin");
}
