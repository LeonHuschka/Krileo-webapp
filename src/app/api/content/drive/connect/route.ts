import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/content/db";
import { DRIVE_STATE_PREFIX, buildDriveAuthUrl } from "@/lib/content/drive";

/** Starts the Google OAuth flow for Drive. The shared callback (/api/google/callback) recognises the state prefix. */
export async function GET() {
  await requireAdmin();
  const state = `${DRIVE_STATE_PREFIX}${randomBytes(16).toString("hex")}`;
  const res = NextResponse.redirect(buildDriveAuthUrl(state));
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
