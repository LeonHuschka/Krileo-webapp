"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  Target,
  CheckCircle2,
  Plus,
  AlertTriangle,
  HelpCircle,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  updateOrder,
  generateOrderTechBrief,
} from "@/app/(app)/orders/actions";
import type { TechBrief } from "@/lib/types/database";

function Section({
  icon,
  title,
  items,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone?: "default" | "muted" | "warn";
}) {
  if (items.length === 0) return null;
  const dot =
    tone === "warn"
      ? "text-amber-400"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-primary";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className={dot}>{icon}</span>
        {title}
      </div>
      <ul className="space-y-1 pl-0.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground">
            <span className={dot}>·</span>
            <span className="min-w-0">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TechBriefPanel({
  orderId,
  initialNotes,
  initialBrief,
}: {
  orderId: string;
  initialNotes: string;
  initialBrief: TechBrief | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [brief, setBrief] = useState<TechBrief | null>(initialBrief);
  const [saving, startSave] = useTransition();
  const [generating, setGenerating] = useState(false);

  function saveNotes() {
    if (notes === initialNotes) return;
    startSave(async () => {
      try {
        await updateOrder(orderId, { description: notes || null });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  async function generate() {
    if (notes.trim() !== initialNotes.trim()) {
      // Persist latest notes first so the brief uses them.
      try {
        await updateOrder(orderId, { description: notes || null });
      } catch {
        /* handled below by the generate call failing loudly */
      }
    }
    setGenerating(true);
    try {
      const result = await generateOrderTechBrief(orderId);
      setBrief(result);
      toast.success("Technik-Brief erstellt");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Anforderungen & Technik-Brief</CardTitle>
        <Button
          size="sm"
          onClick={generate}
          disabled={generating || notes.trim().length < 12}
          className="gap-1.5"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {brief ? "Neu aufbereiten" : "Für Technik aufbereiten"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs">
            Deine Notizen (Kundenanforderungen, Wünsche, Kontext)
          </Label>
          <Textarea
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Einfach frei reinschreiben, was der Kunde will und was zu beachten ist — Claude macht daraus einen sauberen Brief fürs Technik-Team."
          />
          {saving && (
            <p className="text-[11px] text-muted-foreground">Speichere…</p>
          )}
        </div>

        {brief ? (
          <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium leading-relaxed text-foreground">
                {brief.summary}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Section
                icon={<Target className="h-3.5 w-3.5" />}
                title="Ziele"
                items={brief.goals}
              />
              <Section
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                title="Must-haves"
                items={brief.must_haves}
              />
              <Section
                icon={<Plus className="h-3.5 w-3.5" />}
                title="Nice-to-haves"
                items={brief.nice_to_haves}
                tone="muted"
              />
              <Section
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                title="Rahmenbedingungen"
                items={brief.constraints}
                tone="warn"
              />
              <Section
                icon={<HelpCircle className="h-3.5 w-3.5" />}
                title="Offene Fragen"
                items={brief.open_questions}
                tone="warn"
              />
              <Section
                icon={<Layers className="h-3.5 w-3.5" />}
                title="Tech-Stack (Vorschlag)"
                items={brief.suggested_stack}
                tone="muted"
              />
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              Automatisch aus deinen Notizen erstellt · zuletzt{" "}
              {new Date(brief.generated_at).toLocaleString("de-DE")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-4 text-center text-xs text-muted-foreground/70">
            Noch kein Technik-Brief. Notizen eintragen und{" "}
            <span className="font-medium">{'"Für Technik aufbereiten"'}</span>{" "}
            klicken — dann steht hier ein strukturierter Brief für dein Team.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
