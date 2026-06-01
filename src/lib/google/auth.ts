import "server-only";

import {
  loadGoogleConfig,
  patchGoogleConfig,
  saveGoogleConfig,
  type GoogleConfig,
} from "@/lib/google/storage";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// We ask for full calendar access so we can list calendars + create
// events. openid+email so we know which account is connected.
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar",
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function clientId(): string {
  return requireEnv("GOOGLE_OAUTH_CLIENT_ID");
}
function clientSecret(): string {
  return requireEnv("GOOGLE_OAUTH_CLIENT_SECRET");
}
function redirectUri(): string {
  return requireEnv("GOOGLE_OAUTH_REDIRECT_URI");
}

export function buildAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // always ask, so we reliably get a refresh_token
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  id_token?: string;
};

type GoogleUserInfo = {
  email?: string;
};

function decodeIdTokenEmail(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const [, payload] = idToken.split(".");
    const json = JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf-8"),
    ) as GoogleUserInfo;
    return json.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Exchange an OAuth authorization code for tokens, fetch the user's
 * email from the id_token, and persist the result. Returns the saved
 * config so callers can immediately use it.
 */
export async function exchangeCodeAndSave(
  code: string,
): Promise<GoogleConfig> {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Token-Tausch fehlgeschlagen (${resp.status}): ${t}`);
  }
  const data = (await resp.json()) as TokenResponse;
  if (!data.refresh_token) {
    throw new Error(
      "Google hat kein refresh_token zurückgegeben — bitte über Google-Konto-Einstellungen den App-Zugriff widerrufen und erneut verbinden.",
    );
  }
  const email = decodeIdTokenEmail(data.id_token) ?? "(unbekannt)";

  const cfg: GoogleConfig = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
    email,
    calendar_id: "primary",
    calendar_summary: "Hauptkalender",
  };
  await saveGoogleConfig(cfg);
  return cfg;
}

/**
 * Return a non-expired access token, refreshing transparently if
 * needed. Throws if Google isn't connected at all.
 */
export async function getValidAccessToken(): Promise<string> {
  const cfg = await loadGoogleConfig();
  if (!cfg) throw new Error("Google Calendar ist nicht verbunden");
  if (cfg.expires_at > Date.now()) return cfg.access_token;

  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: cfg.refresh_token,
    grant_type: "refresh_token",
  });
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Token-Refresh fehlgeschlagen (${resp.status}): ${t}`);
  }
  const data = (await resp.json()) as TokenResponse;
  await patchGoogleConfig({
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
  });
  return data.access_token;
}
