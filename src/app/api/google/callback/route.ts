import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeAndSave } from "@/lib/google/auth";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;
  const error = url.searchParams.get("error");

  const settingsUrl = new URL("/settings", url.origin);

  if (error) {
    settingsUrl.searchParams.set("google", "error");
    settingsUrl.searchParams.set("msg", error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    settingsUrl.searchParams.set("google", "error");
    settingsUrl.searchParams.set("msg", "state_mismatch");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    await exchangeCodeAndSave(code);
    settingsUrl.searchParams.set("google", "connected");
  } catch (err) {
    settingsUrl.searchParams.set("google", "error");
    settingsUrl.searchParams.set(
      "msg",
      err instanceof Error ? err.message : "exchange_failed",
    );
  }

  const res = NextResponse.redirect(settingsUrl);
  res.cookies.delete("google_oauth_state");
  return res;
}
