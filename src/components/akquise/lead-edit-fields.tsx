"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Save, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateLeadFields } from "@/app/(app)/akquise/actions";

export function LeadEditFields({
  leadId,
  isD2D,
  initial,
}: {
  leadId: string;
  isD2D: boolean;
  initial: {
    owner_name: string | null;
    met_location: string | null;
    meeting_notes: string | null;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [ownerName, setOwnerName] = useState(initial.owner_name ?? "");
  const [metLocation, setMetLocation] = useState(initial.met_location ?? "");
  const [meetingNotes, setMeetingNotes] = useState(initial.meeting_notes ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  function save(rescore: boolean) {
    startTransition(async () => {
      try {
        await updateLeadFields({
          leadId,
          owner_name: ownerName,
          met_location: metLocation,
          meeting_notes: meetingNotes,
          notes,
          rescore,
        });
        toast.success(
          rescore
            ? "Gespeichert — Offer wird neu berechnet"
            : "Gespeichert",
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  if (!open) {
    return (
      <div className="space-y-3">
        {(initial.meeting_notes || isD2D) && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Begegnung &amp; Gesprächsnotizen
              </span>
            </div>
            {initial.met_location && (
              <p className="mb-1 text-xs text-muted-foreground">
                Getroffen bei: {initial.met_location}
              </p>
            )}
            <div className="whitespace-pre-wrap rounded-md border border-border/50 bg-card/60 p-3 text-sm">
              {initial.meeting_notes || (
                <span className="text-muted-foreground">
                  Noch keine Gesprächsnotizen.
                </span>
              )}
            </div>
          </div>
        )}
        {initial.notes && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Notizen
            </div>
            <div className="whitespace-pre-wrap rounded-md border border-border/50 bg-card/60 p-3 text-sm">
              {initial.notes}
            </div>
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" /> Bearbeiten
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/[0.03] p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-primary">
        Bearbeiten
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Inhaber</Label>
          <Input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="h-9 text-sm"
            placeholder="Name des Inhabers"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Getroffen bei / Begegnungsort</Label>
          <Input
            value={metLocation}
            onChange={(e) => setMetLocation(e.target.value)}
            className="h-9 text-sm"
            placeholder="z.B. vor Ort im Laden, Messe…"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1 text-xs">
          Gesprächsnotizen
          <span className="text-[10px] text-muted-foreground">
            (steuern Offer, Pain &amp; Preis)
          </span>
        </Label>
        <Textarea
          value={meetingNotes}
          onChange={(e) => setMeetingNotes(e.target.value)}
          rows={5}
          className="text-sm"
          placeholder="Was wurde besprochen? Was will/braucht der Inhaber? Budget-Signale, Einwände…"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Allgemeine Notizen</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => save(true)}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Speichern &amp; Offer neu berechnen
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => save(false)}
        >
          <Save className="h-3.5 w-3.5" /> Nur speichern
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
