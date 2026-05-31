"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bookAppointment } from "@/app/(app)/akquise/actions";
import type { AppointmentType } from "@/lib/lead-engine/types";

function defaultDateTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  // input[type=datetime-local] uses local time, no timezone suffix.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentDialog({
  leadId,
  triggerLabel = "Demo gebucht",
  triggerVariant = "default",
  defaultType = "demo",
  buttonClassName,
  defaultLeadName,
}: {
  leadId: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary";
  defaultType?: AppointmentType;
  buttonClassName?: string;
  defaultLeadName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<AppointmentType>(defaultType);
  const [scheduledFor, setScheduledFor] = useState(defaultDateTime);
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState("Online-Call");
  const [notes, setNotes] = useState("");

  function submit() {
    if (!scheduledFor) {
      toast.error("Datum/Uhrzeit fehlt");
      return;
    }
    startTransition(async () => {
      try {
        await bookAppointment({
          leadId,
          type,
          scheduledFor: new Date(scheduledFor).toISOString(),
          durationMinutes: duration,
          location: location || undefined,
          notes: notes || undefined,
        });
        toast.success("Termin gebucht");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={triggerVariant}
          className={buttonClassName}
          type="button"
        >
          <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Termin{defaultLeadName ? ` mit ${defaultLeadName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as AppointmentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo / Beratung</SelectItem>
                  <SelectItem value="sale">Sales Call (Closing)</SelectItem>
                  <SelectItem value="onboard">Onboard / Kickoff</SelectItem>
                  <SelectItem value="callback">Rückruf</SelectItem>
                  <SelectItem value="onsite">Vor Ort</SelectItem>
                  <SelectItem value="other">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dauer</Label>
              <Select
                value={String(duration)}
                onValueChange={(v) => setDuration(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 Min</SelectItem>
                  <SelectItem value="30">30 Min</SelectItem>
                  <SelectItem value="45">45 Min</SelectItem>
                  <SelectItem value="60">60 Min</SelectItem>
                  <SelectItem value="90">90 Min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="when">Wann</Label>
            <Input
              id="when"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Ort</Label>
            <Input
              id="location"
              placeholder="Online-Call, Telefon, Adresse…"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Worüber, was vorbereiten…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Speichern…" : "Termin buchen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
