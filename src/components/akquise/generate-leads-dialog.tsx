"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus, X, MapPin } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUNDESLAENDER,
  GERMAN_CITIES_50K,
  expandScope,
} from "@/lib/akquise/geography";
import { generateLeadsForScope } from "@/app/(app)/akquise/actions";

const AUTO_ASSIGN_THRESHOLD = 30;
const CUSTOM = "__custom__";

export type CampaignOption = {
  id: string;
  industry: string;
  city: string;
};

const INDUSTRY_LABEL: Record<string, string> = {
  physios: "Physiotherapeuten",
  aerzte: "Ärzte",
  friseure: "Friseure",
  restaurants: "Restaurants",
  kfz: "KFZ / Werkstätten",
  kosmetik: "Kosmetik",
  verleih: "Verleihe",
  copy_shops: "Copyshops",
};

function labelFor(industry: string): string {
  return (
    INDUSTRY_LABEL[industry] ??
    industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function GenerateLeadsDialog({
  campaigns,
}: {
  campaigns: CampaignOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const knownIndustries = useMemo(() => {
    const set = new Set(campaigns.map((c) => c.industry));
    return Array.from(set).sort();
  }, [campaigns]);

  const [industry, setIndustry] = useState<string>(knownIndustries[0] ?? CUSTOM);
  const [customIndustry, setCustomIndustry] = useState<string>("");

  const [cities, setCities] = useState<string[]>([]);
  const [bundeslaender, setBundeslaender] = useState<string[]>([]);
  const [draftCity, setDraftCity] = useState<string>("");

  const [count, setCount] = useState<number>(25);
  const [autoAssignToggle, setAutoAssignToggle] = useState<boolean>(false);

  const isCustomIndustry = industry === CUSTOM;
  const effectiveIndustry = isCustomIndustry ? customIndustry.trim() : industry;

  const expandedCount = useMemo(
    () => expandScope({ bundeslaender, cities }).length,
    [bundeslaender, cities],
  );

  const forceAutoAssign = count > AUTO_ASSIGN_THRESHOLD;
  const willAutoAssign = forceAutoAssign || autoAssignToggle;

  const hasScope = cities.length > 0 || bundeslaender.length > 0;
  const formValid = effectiveIndustry.length > 0 && hasScope;

  function addCity() {
    const v = draftCity.trim();
    if (!v) return;
    if (cities.includes(v)) {
      toast.error("Ort schon drin");
      return;
    }
    setCities([...cities, v]);
    setDraftCity("");
  }

  function toggleBundesland(bl: string) {
    setBundeslaender((prev) =>
      prev.includes(bl) ? prev.filter((x) => x !== bl) : [...prev, bl],
    );
  }

  function submit() {
    if (!formValid) {
      toast.error("Niche und Gebiet (Bundesland oder Stadt) müssen gesetzt sein");
      return;
    }
    startTransition(async () => {
      try {
        const r = await generateLeadsForScope({
          niche: effectiveIndustry,
          cities,
          bundeslaender,
          count,
          autoAssign: autoAssignToggle,
        });
        const dupes = r.duplicates > 0 ? ` · ${r.duplicates} doppelt` : "";
        const cost =
          typeof r.cost === "number" ? ` · $${r.cost.toFixed(4)}` : "";
        toast.success(
          `${r.inserted} neue Leads — ${r.scored} gescored${dupes}${cost} · ${r.stoppedReason}`,
          { duration: 10_000 },
        );
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
        <Button size="lg" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Leads generieren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Leads generieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Niche */}
          <div className="space-y-2">
            <Label>Niche</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {knownIndustries.map((i) => (
                  <SelectItem key={i} value={i}>
                    {labelFor(i)}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM}>
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3 w-3" />
                    Eigene Niche…
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {isCustomIndustry && (
              <Input
                placeholder="z.B. Tattoo-Studios, Zahnärzte…"
                value={customIndustry}
                onChange={(e) => setCustomIndustry(e.target.value)}
                autoFocus
              />
            )}
          </div>

          {/* Gebiet — Bundesländer */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Bundesländer (= alle Städte &gt;50k darin)
            </Label>
            <div className="flex flex-wrap gap-1">
              {BUNDESLAENDER.map((bl) => {
                const on = bundeslaender.includes(bl);
                return (
                  <button
                    key={bl}
                    type="button"
                    onClick={() => toggleBundesland(bl)}
                    className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                      on
                        ? "border-violet-500/50 bg-violet-500/20 text-violet-200"
                        : "border-border/50 text-muted-foreground hover:border-violet-500/40"
                    }`}
                  >
                    {bl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gebiet — einzelne Städte / Freitext */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Einzelne Städte / Orte (Vorschläge &gt;50k, oder frei wie
              Nürtingen)
            </Label>
            <div className="flex gap-1">
              <Input
                list="gen-cities50k"
                value={draftCity}
                onChange={(e) => setDraftCity(e.target.value)}
                placeholder="Stadt/Ort eingeben…"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCity();
                  }
                }}
              />
              <datalist id="gen-cities50k">
                {GERMAN_CITIES_50K.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
              </datalist>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addCity}
                className="h-8 px-2"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {cities.length > 0 && (
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
            )}
            {hasScope && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Gebiet = {expandedCount} Orte. Zieht frische zuerst,
                überspringt ausgeschöpfte.
              </p>
            )}
          </div>

          {/* Anzahl */}
          <div className="space-y-2">
            <Label htmlFor="count">Anzahl (Ziel)</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {[10, 25, 50, 100].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCount(n)}
                  className="h-7 text-xs"
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="cursor-pointer">
                  Channels automatisch zuweisen
                </Label>
                <p className="text-xs text-muted-foreground">
                  Hoher Score (oder keine Mail) → Call. Sonst Mail.
                </p>
              </div>
              <Checkbox
                checked={willAutoAssign}
                disabled={forceAutoAssign}
                onCheckedChange={(v) => setAutoAssignToggle(v === true)}
              />
            </div>
            {forceAutoAssign && (
              <p className="mt-2 text-xs text-amber-300/90">
                Bei mehr als {AUTO_ASSIGN_THRESHOLD} Leads wird immer
                auto-zugewiesen.
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Scrape → Enrich → Score läuft automatisch nach. Kann je nach
            Anzahl 30 Sekunden bis ein paar Minuten dauern.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending || !formValid}>
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Generiere…
              </>
            ) : (
              `${count} Leads holen`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
