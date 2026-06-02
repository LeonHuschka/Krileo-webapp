"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  deleteLeadsByCampaign,
  listCampaignsWithCounts,
  type CampaignWithCount,
} from "@/app/(app)/akquise/actions";

/**
 * Lists every campaign with its lead count + a per-row delete. Used to
 * nuke bad batches after a runaway scrape (e.g. user asked for 20 but
 * ended up with 40 after retries).
 */
export function CleanupDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const r = await listCampaignsWithCounts();
      setCampaigns(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) reload();
  }, [open]);

  function remove(c: CampaignWithCount) {
    if (
      !confirm(
        `${c.lead_count} Leads aus "${c.industry} / ${c.city}" wirklich LÖSCHEN?\n\nDas ist endgültig — Termine + Events bleiben vorerst (cascade auf delete).`,
      )
    )
      return;
    setBusyId(c.id);
    startTransition(async () => {
      try {
        const r = await deleteLeadsByCampaign(c.id);
        toast.success(`${r.deleted} Leads gelöscht`);
        await reload();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Aufräumen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Campaigns aufräumen
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Pro Niche/Stadt-Kombi: Lead-Count + Lösch-Button. Praktisch um
          Runaway-Scrapes (zu viele Leads beim Generieren) komplett zu
          entfernen und neu zu starten.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Lade…
          </div>
        ) : campaigns.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Keine Campaigns mit Leads.
          </p>
        ) : (
          <div className="space-y-1">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-card/40 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {c.industry}{" "}
                    <span className="text-muted-foreground">/</span>{" "}
                    {c.city}
                  </div>
                  {c.name && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {c.name}
                    </div>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className="border-primary/40 bg-primary/15 text-[10px] text-primary"
                >
                  {c.lead_count} Leads
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(c)}
                  disabled={pending || c.lead_count === 0}
                  className="h-7 gap-1 text-[11px] text-rose-300 hover:bg-rose-500/10 hover:text-rose-300"
                  title={`${c.lead_count} Leads aus dieser Campaign löschen`}
                >
                  {busyId === c.id && pending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Löschen
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
