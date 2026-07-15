import { headers } from "next/headers";
import { get } from "@vercel/blob";
import { auth } from "@/lib/auth";

// Registration forms live in a private Blob store — the raw blob URL 403s
// without a token, so every "View" click routes through here instead,
// gated by an admin session, and streams the PDF back. Falls back to a
// plain redirect for a manually-pasted URL that isn't one of our own blobs
// (e.g. a Google Drive link someone linked before Blob storage existed).
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") return new Response("Admin only", { status: 403 });

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  try {
    const blob = await get(url, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!blob || blob.stream === null) return new Response("Not found", { status: 404 });
    return new Response(blob.stream, {
      headers: {
        "Content-Type": blob.blob.contentType,
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return Response.redirect(url, 307);
  }
}
