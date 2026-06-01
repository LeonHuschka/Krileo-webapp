import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthUrl } from "@/lib/google/auth";

/**
 * Kick off the Google OAuth flow. Stores a CSRF-style state token in a
 * cookie so the callback can verify the round-trip.
 */
export async function GET() {
  const state = randomBytes(16).toString("hex");
  const url = buildAuthUrl(state);
  const res = NextResponse.redirect(url);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
