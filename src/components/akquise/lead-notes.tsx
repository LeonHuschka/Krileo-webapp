"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight,
  Save,
  Sparkles,
  Loader2,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateLeadFields } from "@/app/(app)/akquise/actions";

type SectionKey = "pitch" | "close" | "sale";

export function LeadNotes({
  leadId,
  initial,
}: {
  leadId: string;
  initial: {
    met_location: string | null;
    meeting_notes: string | null;
    close_notes: string | null;
    sale_notes: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<SectionKey | null>(null);

  const [metLocation, setMetLocation] = useState(initial.met_location ?? "");
  const [pitch, setPitch] = useState(initial.meeting_notes ?? "");
  const [close, setClose] = useState(initial.close_notes ?? "");
  const [sale, setSale] = useState(initial.sale_notes ?? "");

  function toggle(k: SectionKey) {
    setOpen((cur) => (cur === k ? null : k));
  }

  function savePitch(rescore: boolean) {
    startTransition(async () => {
      try {
        await updateLeadFields({
          leadId,
          met_location: metLocation,
          meeting_notes: pitch,
          rescore,
        });
        toast.success(rescore ? "Gespeichert — Offer wird neu berechnet" : "Pitch gespeichert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function saveField(field: "close_notes" | "sale_notes", value: string) {
    startTransition(async () => {
      try {
        await updateLeadFields({ leadId, [field]: value });
        toast.success("Gespeichert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const filled = {
    pitch: !!(initial.meeting_notes || initial.met_location),
    close: !!initial.close_notes,
    sale: !!initial.sale_notes,
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card/40">
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" /> Notes
      </div>

      {/* PITCH */}
      <Section
        label="Pitch"
        hint="steuert Offer, Pain & Preis"
        filled={filled.pitch}
        open={open === "pitch"}
        onToggle={() => toggle("pitch")}
      >
        <div className="space-y-2">
          <Input
            value={metLocation}
            onChange={(e) => setMetLocation(e.target.value)}
            placeholder="Getroffen bei / Begegnungsort…"
            className="h-8 text-xs"
          />
          <Textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            rows={6}
            className="text-sm"
            placeholder="Was wurde besprochen? Was will/braucht der Inhaber? Budget-Signale, Einwände…"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => savePitch(true)}>
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
              onClick={() => savePitch(false)}
            >
              <Save className="h-3.5 w-3.5" /> Nur speichern
            </Button>
          </div>
        </div>
      </Section>

      {/* CLOSE */}
      <Section
        label="Close"
        hint="Closing-Phase"
        filled={filled.close}
        open={open === "close"}
        onToggle={() => toggle("close")}
      >
        <div className="space-y-2">
          <Textarea
            value={close}
            onChange={(e) => setClose(e.target.value)}
            rows={5}
            className="text-sm"
            placeholder="Angebot raus, Einwände, Verhandlung, nächste Schritte zum Abschluss…"
          />
          <Button
            size="sm"
            disabled={pending}
            onClick={() => saveField("close_notes", close)}
          >
            <Save className="h-3.5 w-3.5" /> Speichern
          </Button>
        </div>
      </Section>

      {/* SALE */}
      <Section
        label="Sale"
        hint="nach dem Verkauf / Übergabe"
        filled={filled.sale}
        open={open === "sale"}
        onToggle={() => toggle("sale")}
        last
      >
        <div className="space-y-2">
          <Textarea
            value={sale}
            onChange={(e) => setSale(e.target.value)}
            rows={5}
            className="text-sm"
            placeholder="Was wurde verkauft, Scope, Zugänge, Onboarding-Infos…"
          />
          <Button
            size="sm"
            disabled={pending}
            onClick={() => saveField("sale_notes", sale)}
          >
            <Save className="h-3.5 w-3.5" /> Speichern
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  label,
  hint,
  filled,
  open,
  onToggle,
  last,
  children,
}: {
  label: string;
  hint: string;
  filled: boolean;
  open: boolean;
  onToggle: () => void;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={last ? "" : "border-b border-border/50"}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-card/60"
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="text-sm font-medium">{label}</span>
        {filled && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="befüllt" />
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/70">
          {hint}
        </span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
