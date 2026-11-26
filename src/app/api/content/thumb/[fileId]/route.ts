import { NextResponse, type NextRequest } from "next/server";
import { thumbnail } from "@/lib/content/drive";
import { canAccessFile } from "@/lib/content/file-access";

/** Preview image of a video in Drive (login or ?t=<link token>). */
export async function GET(req: NextRequest, { params }: { params: { fileId: string } }) {
  if (!(await canAccessFile(params.fileId, req.nextUrl.searchParams.get("t")))) {
    return new NextResponse(null, { status: 403 });
  }
  const img = await thumbnail(params.fileId).catch(() => null);
  if (!img) return new NextResponse(null, { status: 404 });
  return new NextResponse(img.bytes, {
    headers: { "Content-Type": img.type, "Cache-Control": "private, max-age=86400" },
  });
}
