import { NextResponse } from "next/server";
import { clearGoogleConfig } from "@/lib/google/storage";

export async function POST() {
  try {
    await clearGoogleConfig();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
