import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export default function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/app")) {
    // Lightweight cookie-presence check only — no DB round trip here.
    // Server components re-verify the real session via auth.api.getSession().
    const sessionCookie = getSessionCookie(req);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app(.*)"],
};
