import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeAndSave } from "@/lib/google/auth";
import { DRIVE_STATE_PREFIX, exchangeDriveCode } from "@/lib/content/drive";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;
  const error = url.searchParams.get("error");

  // Content pipeline: Drive connection started from /content/einstellungen.
  const isDrive = !!state?.startsWith(DRIVE_STATE_PREFIX);
  const settingsUrl = new URL(isDrive ? "/social/einstellungen" : "/settings", url.origin);
  const flag = isDrive ? "drive" : "google";

  if (error) {
    settingsUrl.searchParams.set(flag, "error");
    settingsUrl.searchParams.set("msg", error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    settingsUrl.searchParams.set(flag, "error");
    settingsUrl.searchParams.set("msg", "state_mismatch");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    if (isDrive) await exchangeDriveCode(code);
    else await exchangeCodeAndSave(code);
    settingsUrl.searchParams.set(flag, "connected");
  } catch (err) {
    settingsUrl.searchParams.set(flag, "error");
    settingsUrl.searchParams.set(
      "msg",
      err instanceof Error ? err.message : "exchange_failed",
    );
  }

  const res = NextResponse.redirect(settingsUrl);
  res.cookies.delete("google_oauth_state");
  return res;
}
