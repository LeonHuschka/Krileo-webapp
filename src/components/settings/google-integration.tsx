"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Check, Loader2, Plug, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setGoogleCalendar } from "@/app/(app)/settings/actions";
import type { GoogleCalendar } from "@/lib/google/calendar";

export function GoogleIntegrationCard({
  connected,
  email,
  calendarId,
  calendarSummary,
  calendars,
}: {
  connected: boolean;
  email?: string;
  calendarId?: string;
  calendarSummary?: string;
  calendars: GoogleCalendar[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);

  function connect() {
    window.location.href = "/api/google/connect";
  }

  function disconnect() {
    if (
      !confirm(
        "Google Calendar trennen?\n\nApp-Termine werden nicht mehr automatisch zu Google synchronisiert. Bestehende Events in Google bleiben erhalten.",
      )
    )
      return;
    startTransition(async () => {
      try {
        const resp = await fetch("/api/google/disconnect", {
          method: "POST",
        });
        if (!resp.ok) throw new Error("Disconnect fehlgeschlagen");
        toast.success("Google getrennt");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function pickCalendar(next: string) {
    const cal = calendars.find((c) => c.id === next);
    setPicking(true);
    startTransition(async () => {
      try {
        await setGoogleCalendar(next, cal?.summary ?? next);
        toast.success(`Kalender → ${cal?.summary ?? next}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      } finally {
        setPicking(false);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-primary" />
          Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-300">
                <Check className="h-4 w-4" />
                <span className="font-medium">Verbunden</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Account: <span className="text-foreground">{email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Zielkalender (wohin App-Termine geschrieben werden)
              </label>
              <Select
                value={calendarId ?? "primary"}
                onValueChange={pickCalendar}
                disabled={pending || picking || calendars.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {calendarSummary ?? "Hauptkalender"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {calendars.length === 0 && (
                    <SelectItem value="primary" disabled>
                      Hauptkalender (lade Kalender…)
                    </SelectItem>
                  )}
                  {calendars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.summary}
                      {c.primary && " (Hauptkalender)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tipp: Wenn du in Calendly denselben Kalender als Backing-
                Kalender wählst, landen Calendly-Buchungen auch
                automatisch in der Cold-Call-Ansicht.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                disabled={pending}
                className="gap-1.5"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unplug className="h-3.5 w-3.5" />
                )}
                Trennen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={connect}
                disabled={pending}
                className="gap-1.5"
              >
                <Plug className="h-3.5 w-3.5" />
                Neu autorisieren
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Verbinde deinen Google-Account damit App-Termine automatisch
              in deinem Kalender landen — und Calendly/iPhone-Termine in
              der Cold-Call-Ansicht erscheinen.
            </p>
            <Button onClick={connect} className="gap-1.5">
              <Plug className="h-4 w-4" />
              Mit Google verbinden
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
