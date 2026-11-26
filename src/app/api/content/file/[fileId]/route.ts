import { NextResponse, type NextRequest } from "next/server";
import { streamFile } from "@/lib/content/drive";
import { canAccessFile } from "@/lib/content/file-access";

/**
 * Streams a video from Drive (inline playback with seeking, or download
 * with ?dl=<filename>). Login or ?t=<link token>.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest, { params }: { params: { fileId: string } }) {
  if (!(await canAccessFile(params.fileId, req.nextUrl.searchParams.get("t")))) {
    return new NextResponse(null, { status: 403 });
  }
  const upstream = await streamFile(params.fileId, req.headers.get("range"));
  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=3600");
  const dl = req.nextUrl.searchParams.get("dl");
  if (dl) headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(dl)}`);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
