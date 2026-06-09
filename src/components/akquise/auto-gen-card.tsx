"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Play,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  X,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  runAutoGenerationNow,
  setAutoGenSettings,
  type AutoGenSettings,
} from "@/app/(app)/akquise/actions";

export function AutoGenCard({
  initial,
}: {
  initial: AutoGenSettings;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<number>(initial.daily_lead_target);
  const [niches, setNiches] = useState<string[]>(initial.auto_gen_niches);
  const [cities, setCities] = useState<string[]>(initial.auto_gen_cities);
  const [draftNiche, setDraftNiche] = useState("");
  const [draftCity, setDraftCity] = useState("");

  const configured =
    initial.daily_lead_target > 0 &&
    initial.auto_gen_niches.length > 0 &&
    initial.auto_gen_cities.length > 0;

  function save() {
    startTransition(async () => {
      try {
        await setAutoGenSettings({
          daily_lead_target: target,
          auto_gen_niches: niches,
          auto_gen_cities: cities,
        });
        toast.success("Auto-Gen Settings gespeichert");
        setEditing(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function runNow() {
    if (!configured) {
      toast.error("Erst Niches + Städte konfigurieren");
      return;
    }
    if (
      !confirm(
        `Auto-Generation starten — Ziel: ${initial.daily_lead_target} Leads aus ${initial.auto_gen_niches.length} Niches × ${initial.auto_gen_cities.length} Städten. Kann 2-4 Min dauern.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        const r = await runAutoGenerationNow();
        toast.success(
          `${r.newLeads} neue Leads (${r.duplicates} doppelt) · $${r.cost.toFixed(4)} · ${Math.round(r.elapsedMs / 1000)}s · Reason: ${r.stoppedReason}`,
          { duration: 12_000 },
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function addNiche() {
    const v = draftNiche.trim();
    if (!v) return;
    if (niches.includes(v)) {
      toast.error("Niche schon drin");
      return;
    }
    setNiches([...niches, v]);
    setDraftNiche("");
  }

  function addCity() {
    const v = draftCity.trim();
    if (!v) return;
    if (cities.includes(v)) {
      toast.error("Stadt schon drin");
      return;
    }
    setCities([...cities, v]);
    setDraftCity("");
  }

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] via-card to-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              Auto-Lead-Generation
            </div>
            <p className="text-xs text-muted-foreground">
              {configured
                ? `Täglich 05:00 — Ziel: ${initial.daily_lead_target} Leads aus ${initial.auto_gen_niches.length} Niches × ${initial.auto_gen_cities.length} Städten.`
                : "Konfiguriere Ziel + Niches + Städte. Dann läuft täglich ein Cron der dir frische Leads scrapt."}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(!editing)}
              disabled={pending}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <SettingsIcon className="h-3 w-3" />
              {editing ? "Schließen" : "Edit"}
            </Button>
            {configured && (
              <Button
                type="button"
                size="sm"
                onClick={runNow}
                disabled={pending}
                className="h-7 gap-1 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-700"
              >
                {pending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Jetzt laufen
              </Button>
            )}
          </div>
        </div>

        {configured && !editing && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {initial.auto_gen_niches.map((n) => (
              <Badge
                key={n}
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-300"
              >
                {n}
              </Badge>
            ))}
            {initial.auto_gen_cities.map((c) => (
              <Badge
                key={c}
                variant="outline"
                className="border-sky-500/40 bg-sky-500/15 text-[10px] text-sky-300"
              >
                {c}
              </Badge>
            ))}
          </div>
        )}

        {editing && (
          <div className="space-y-3 rounded-lg border border-border/40 bg-card/40 p-3">
            <div className="space-y-1">
              <Label htmlFor="target" className="text-xs">
                Tägliches Lead-Ziel (0 = aus)
              </Label>
              <Input
                id="target"
                type="number"
                min={0}
                max={500}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Niches (z.B. Friseur, Praxis, Druckerei)</Label>
              <div className="flex gap-1">
                <Input
                  value={draftNiche}
                  onChange={(e) => setDraftNiche(e.target.value)}
                  placeholder="Niche eingeben…"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addNiche();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addNiche}
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {niches.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNiches(niches.filter((x) => x !== n))}
                    className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    {n}
                    <X className="h-2.5 w-2.5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Städte (z.B. Stuttgart, München, Berlin)</Label>
              <div className="flex gap-1">
                <Input
                  value={draftCity}
                  onChange={(e) => setDraftCity(e.target.value)}
                  placeholder="Stadt eingeben…"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCity();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addCity}
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {cities.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCities(cities.filter((x) => x !== c))}
                    className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    {c}
                    <X className="h-2.5 w-2.5" />
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={save}
              disabled={pending}
              className="h-7 w-full gap-1 text-xs"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Settings speichern
            </Button>

            <p className="text-[10px] text-muted-foreground">
              Cron läuft jeden Tag um 05:00 Berlin. Bei {niches.length}×{cities.length} = {niches.length * cities.length} Kombis rotiert er bis zum Ziel von {target}. Stoppt automatisch wenn nur noch Duplikate kommen.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
