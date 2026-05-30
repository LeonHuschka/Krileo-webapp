"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
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
import { generateLeads } from "@/app/(app)/akquise/actions";

const AUTO_ASSIGN_THRESHOLD = 30;

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
};

export function GenerateLeadsDialog({
  campaigns,
}: {
  campaigns: CampaignOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const industries = useMemo(() => {
    const set = new Set(campaigns.map((c) => c.industry));
    return Array.from(set);
  }, [campaigns]);

  const [industry, setIndustry] = useState<string>(industries[0] ?? "");
  const citiesForIndustry = useMemo(
    () => campaigns.filter((c) => c.industry === industry).map((c) => c.city),
    [campaigns, industry],
  );
  const [city, setCity] = useState<string>(citiesForIndustry[0] ?? "");
  const [count, setCount] = useState<number>(25);
  const [autoAssignToggle, setAutoAssignToggle] = useState<boolean>(false);

  // When the user picks a new industry, jump to that industry's first city
  function pickIndustry(next: string) {
    setIndustry(next);
    const cities = campaigns
      .filter((c) => c.industry === next)
      .map((c) => c.city);
    setCity(cities[0] ?? "");
  }

  const campaign = useMemo(
    () =>
      campaigns.find((c) => c.industry === industry && c.city === city) ??
      null,
    [campaigns, industry, city],
  );

  const forceAutoAssign = count > AUTO_ASSIGN_THRESHOLD;
  const willAutoAssign = forceAutoAssign || autoAssignToggle;

  function submit() {
    if (!campaign) {
      toast.error("Keine passende Campaign gefunden");
      return;
    }
    startTransition(async () => {
      try {
        const r = await generateLeads({
          campaignId: campaign.id,
          count,
          autoAssign: autoAssignToggle,
        });
        toast.success(
          `${r.inserted} neue Leads — ${r.scored} gescored${
            r.autoAssigned > 0
              ? `, ${r.autoAssigned} auto-zugewiesen`
              : ""
          }`,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Neue Leads generieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Niche</Label>
              <Select value={industry} onValueChange={pickIndustry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((i) => (
                    <SelectItem key={i} value={i}>
                      {INDUSTRY_LABEL[i] ?? i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stadt</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {citiesForIndustry.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="count">Anzahl</Label>
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
                  Mail wenn E-Mail vorhanden, sonst Call.
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
          <Button onClick={submit} disabled={pending || !campaign}>
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
