import "server-only";

import { getValidAccessToken } from "@/lib/google/auth";
import { loadGoogleConfig } from "@/lib/google/storage";

const API_BASE = "https://www.googleapis.com/calendar/v3";

export type GoogleCalendar = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  timeZone?: string;
};

export type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink?: string;
};

async function authedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getValidAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export async function listGoogleCalendars(): Promise<GoogleCalendar[]> {
  const resp = await authedFetch(`${API_BASE}/users/me/calendarList`);
  if (!resp.ok) throw new Error(`listCalendars failed (${resp.status})`);
  const data = (await resp.json()) as { items?: GoogleCalendar[] };
  return data.items ?? [];
}

export async function listGoogleEvents(opts: {
  timeMin: string;
  timeMax: string;
  calendarId?: string;
}): Promise<GoogleEvent[]> {
  const cfg = await loadGoogleConfig();
  if (!cfg) return [];
  const calId = opts.calendarId ?? cfg.calendar_id ?? "primary";
  const p = new URLSearchParams({
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const resp = await authedFetch(
    `${API_BASE}/calendars/${encodeURIComponent(calId)}/events?${p}`,
  );
  if (!resp.ok) {
    // Don't blow up the page if Google has a transient issue
    return [];
  }
  const data = (await resp.json()) as { items?: GoogleEvent[] };
  return (data.items ?? []).filter((e) => e.status !== "cancelled");
}

export type CreateEventInput = {
  summary: string;
  description?: string;
  location?: string | null;
  startIso: string;
  durationMinutes: number;
  timeZone?: string;
};

export type CreateEventResult = {
  id: string;
  calendarId: string;
  htmlLink?: string;
};

export async function createGoogleEvent(
  input: CreateEventInput,
): Promise<CreateEventResult> {
  const cfg = await loadGoogleConfig();
  if (!cfg) throw new Error("Google Calendar nicht verbunden");
  const calId = cfg.calendar_id ?? "primary";

  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const tz = input.timeZone ?? "Europe/Berlin";

  const body = {
    summary: input.summary,
    description: input.description ?? "",
    location: input.location ?? undefined,
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    reminders: { useDefault: true },
  };

  const resp = await authedFetch(
    `${API_BASE}/calendars/${encodeURIComponent(calId)}/events`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`createEvent failed (${resp.status}): ${t}`);
  }
  const ev = (await resp.json()) as GoogleEvent & { htmlLink?: string };
  return { id: ev.id, calendarId: calId, htmlLink: ev.htmlLink };
}

export async function patchGoogleEvent(
  eventId: string,
  calendarId: string,
  patch: Partial<{
    summary: string;
    description: string;
    status: "confirmed" | "cancelled" | "tentative";
    location: string | null;
    startIso: string;
    durationMinutes: number;
    timeZone: string;
  }>,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.summary != null) body.summary = patch.summary;
  if (patch.description != null) body.description = patch.description;
  if (patch.status != null) body.status = patch.status;
  if (patch.location !== undefined) body.location = patch.location ?? null;
  if (patch.startIso && patch.durationMinutes) {
    const start = new Date(patch.startIso);
    const end = new Date(
      start.getTime() + patch.durationMinutes * 60_000,
    );
    const tz = patch.timeZone ?? "Europe/Berlin";
    body.start = { dateTime: start.toISOString(), timeZone: tz };
    body.end = { dateTime: end.toISOString(), timeZone: tz };
  }
  const resp = await authedFetch(
    `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`patchEvent failed (${resp.status}): ${t}`);
  }
}
