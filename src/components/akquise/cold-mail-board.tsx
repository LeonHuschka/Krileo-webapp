"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Mail,
  Send,
  Play,
  Pause,
  Plus,
  Loader2,
  Webhook,
  Reply,
  Inbox,
  Eye,
  Ban,
  Copy,
  ExternalLink,
  Tag,
  Link2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SMARTLEAD_MERGE_TAGS } from "@/lib/smartlead/mapping";
import {
  assignSmartleadCampaignNiche,
  createSmartleadCampaignForNiche,
  pushLeadsToSmartlead,
  registerSmartleadWebhook,
  setSmartleadCampaignStatus,
} from "@/app/(app)/akquise/actions";
import type { PoolLead, ReplyLead } from "@/app/(app)/akquise/mail/page";

type Analytics = {
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
  clicked: number;
  unsubscribed: number;
  total: number;
};

type CampaignView = {
  id: number;
  name: string;
  status: string;
  localPushed: number;
  niche: string | null;
  analytics: Analytics;
};

const SMARTLEAD_APP_URL = "https://app.smartlead.ai";

export function ColdMailBoard({
  configured,
  campaigns,
  poolLeads,
  replies,
}: {
  configured: boolean;
  campaigns: CampaignView[];
  poolLeads: PoolLead[];
  replies: ReplyLead[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Pool leads grouped by niche, preserving the server's score order.
  const poolByNiche = useMemo(() => {
    const m: Record<string, PoolLead[]> = {};
    for (const l of poolLeads) {
      const k = l.niche ?? "Sonstige";
      (m[k] ??= []).push(l);
    }
    return m;
  }, [poolLeads]);

  const poolNiches = useMemo(
    () =>
      Object.entries(poolByNiche)
        .map(([niche, leads]) => ({ niche, count: leads.length }))
        .sort((a, b) => b.count - a.count),
    [poolByNiche],
  );

  const boundCampaigns = campaigns.filter((c) => c.niche);
  const unboundCampaigns = campaigns.filter((c) => !c.niche);
  const nichesWithCampaign = new Set(
    boundCampaigns.map((c) => c.niche as string),
  );
  const openNiches = poolNiches.filter(
    (n) => !nichesWithCampaign.has(n.niche),
  );

  // ── handlers ────────────────────────────────────────────────────────
  function handlePush(
    campaignId: number,
    campName: string,
    niche: string,
    leadIds: string[],
  ) {
    if (leadIds.length === 0) {
      toast.error("Keine neuen Leads für diese Niche");
      return;
    }
    if (
      !window.confirm(
        `${leadIds.length} ${niche}-Leads in „${campName}" pushen?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await pushLeadsToSmartlead({ campaignId, leadIds });
        toast.success(
          `${res.uploaded} gepusht${res.duplicates ? ` · ${res.duplicates} Dups` : ""}${
            res.invalid ? ` · ${res.invalid} ungültig` : ""
          }`,
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Push fehlgeschlagen");
      }
    });
  }

  function handleCreateForNiche(niche: string) {
    const name = window.prompt(
      `Name der Smartlead-Kampagne für „${niche}":`,
      `${niche} – Cold Mail`,
    );
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const res = await createSmartleadCampaignForNiche({
          name: trimmed,
          niche,
        });
        toast.success(`„${res.name}" angelegt & an ${niche} gebunden`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
      }
    });
  }

  function handleAssignNiche(campaignId: number, niche: string) {
    startTransition(async () => {
      try {
        await assignSmartleadCampaignNiche(campaignId, niche);
        toast.success(`Kampagne an ${niche} gebunden`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Zuordnen fehlgeschlagen");
      }
    });
  }

  function handleStatus(id: number, status: "START" | "PAUSED") {
    startTransition(async () => {
      try {
        await setSmartleadCampaignStatus(id, status);
        toast.success(status === "START" ? "Kampagne gestartet" : "Pausiert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Status-Update fehlgeschlagen");
      }
    });
  }

  function handleWebhook(id: number) {
    startTransition(async () => {
      try {
        await registerSmartleadWebhook(id);
        toast.success("Webhook registriert — Replies fließen jetzt rein");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Webhook fehlgeschlagen");
      }
    });
  }

  const poolCount = poolLeads.length;

  return (
    <Tabs defaultValue="push" className="space-y-4">
      <TabsList>
        <TabsTrigger value="push">Kampagnen &amp; Push</TabsTrigger>
        <TabsTrigger value="replies" className="gap-1.5">
          <Reply className="h-3.5 w-3.5" /> Replies
          {replies.length > 0 && (
            <span className="ml-1 rounded bg-emerald-500/20 px-1.5 text-[11px] text-emerald-300">
              {replies.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="vars">Merge-Variablen</TabsTrigger>
      </TabsList>

      {/* ── KAMPAGNEN & PUSH ─────────────────────────────────────────── */}
      <TabsContent value="push" className="space-y-6">
        {!configured ? null : (
          <>
            {/* Bound campaigns — push lives inside each card, niche-scoped */}
            {boundCampaigns.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Kampagnen
                </h2>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {boundCampaigns.map((c) => (
                    <CampaignCard
                      key={c.id}
                      c={c}
                      nicheLeads={poolByNiche[c.niche as string] ?? []}
                      pending={pending}
                      onPush={handlePush}
                      onStatus={handleStatus}
                      onWebhook={handleWebhook}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Niches present in the pool that have no campaign yet */}
            {openNiches.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Niches ohne Kampagne
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {openNiches.map((n) => (
                    <NicheCreateCard
                      key={n.niche}
                      niche={n.niche}
                      count={n.count}
                      pending={pending}
                      onCreate={handleCreateForNiche}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Existing Smartlead campaigns not yet bound to a niche */}
            {unboundCampaigns.length > 0 && (
              <section className="space-y-3">
                <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" /> Nicht zugeordnete Kampagnen
                </h2>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {unboundCampaigns.map((c) => (
                    <UnboundCampaignCard
                      key={c.id}
                      c={c}
                      poolNiches={poolNiches}
                      pending={pending}
                      onAssign={handleAssignNiche}
                    />
                  ))}
                </div>
              </section>
            )}

            {poolCount === 0 && boundCampaigns.length === 0 && (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Kein E-Mail-Lead bereit. Im Lead-Browser Leads auf Channel{" "}
                  <strong>E-Mail</strong> setzen (oder Auto-Assign) — dann
                  erscheinen hier pro Niche Cards.
                </CardContent>
              </Card>
            )}
          </>
        )}
      </TabsContent>

      {/* ── REPLIES ──────────────────────────────────────────────────── */}
      <TabsContent value="replies" className="space-y-3">
        {replies.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Inbox className="h-4 w-4" /> Noch keine Replies. Sobald jemand
              auf eine Mail antwortet (Webhook aktiv), erscheint er hier.
            </CardContent>
          </Card>
        ) : (
          replies.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Reply className="h-4 w-4 text-emerald-400" />
                  <span className="font-medium">{r.business_name}</span>
                  {r.owner_name && (
                    <span className="text-sm text-muted-foreground">
                      {r.owner_name}
                    </span>
                  )}
                  {r.smartlead_last_reply_at && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(r.smartlead_last_reply_at).toLocaleString(
                        "de-DE",
                      )}
                    </span>
                  )}
                </div>
                {r.smartlead_last_reply_text && (
                  <p className="rounded-md bg-muted/40 p-2 text-sm text-muted-foreground">
                    {r.smartlead_last_reply_text.slice(0, 400)}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link href={`/akquise/leads/${r.id}`}>
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-3.5 w-3.5" /> Lead öffnen
                    </Button>
                  </Link>
                  {r.owner_email && (
                    <a href={`mailto:${r.owner_email}`}>
                      <Button size="sm" variant="outline">
                        <Mail className="h-3.5 w-3.5" /> Antworten
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      {/* ── MERGE VARIABLES ──────────────────────────────────────────── */}
      <TabsContent value="vars" className="space-y-3">
        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <p className="text-muted-foreground">
              Diese Variablen reist jeder Lead automatisch mit, wenn du ihn
              pushst. Bau sie in dein Smartlead-Template ein — der Text bleibt
              pro Kampagne gleich, füllt sich aber pro Lead selbst aus.
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {SMARTLEAD_MERGE_TAGS.map((t) => (
                <MergeTagRow key={t.tag} tag={t.tag} desc={t.desc} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground/70">
              Beispiel: „Hallo {"{{first_name}}"}, {"{{hook}}"} … Wir würden
              dir {"{{offer_pitch}}"} ({"{{price_range}}"}) bauen.“
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// ── Niche create card ──────────────────────────────────────────────────
function NicheCreateCard({
  niche,
  count,
  pending,
  onCreate,
}: {
  niche: string;
  count: number;
  pending: boolean;
  onCreate: (niche: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => onCreate(niche)}
      className="group flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-card p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/[0.04] disabled:opacity-60"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
        <Plus className="h-5 w-5" />
      </div>
      <div className="font-medium capitalize">{niche}</div>
      <div className="text-xs text-muted-foreground">
        {count} Lead{count === 1 ? "" : "s"} bereit
      </div>
      <div className="text-[11px] text-muted-foreground/70">
        Kampagne anlegen
      </div>
    </button>
  );
}

// ── Bound campaign card (push inside) ──────────────────────────────────
function CampaignCard({
  c,
  nicheLeads,
  pending,
  onPush,
  onStatus,
  onWebhook,
}: {
  c: CampaignView;
  nicheLeads: PoolLead[];
  pending: boolean;
  onPush: (
    campaignId: number,
    campName: string,
    niche: string,
    leadIds: string[],
  ) => void;
  onStatus: (id: number, status: "START" | "PAUSED") => void;
  onWebhook: (id: number) => void;
}) {
  const available = nicheLeads.length;
  const [count, setCount] = useState<number>(Math.min(available, 25) || 0);
  const isActive = c.status === "ACTIVE";
  const a = c.analytics;
  const niche = c.niche as string;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{c.name}</span>
              <Badge
                variant="outline"
                className="shrink-0 border-primary/40 bg-primary/10 text-[10px] capitalize text-primary"
              >
                {niche}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              #{c.id} · {c.localPushed} gepusht
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              isActive
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : c.status === "PAUSED"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                  : "border-border/60"
            }
          >
            {c.status}
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat icon={Send} label="Versendet" value={a.sent} />
          <Stat icon={Eye} label="Geöffnet" value={a.opened} />
          <Stat icon={Reply} label="Antworten" value={a.replied} accent="text-emerald-300" />
          <Stat icon={Ban} label="Bounces" value={a.bounced} accent="text-rose-300" />
        </div>

        {/* In-card push — scoped to THIS campaign's niche only */}
        <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
          {available === 0 ? (
            <p className="text-xs text-muted-foreground">
              Keine neuen <span className="capitalize">{niche}</span>-Leads im
              Pool.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {available} bereit
              </span>
              <Input
                type="number"
                min={1}
                max={available}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="ml-auto h-8 w-20"
              />
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  onPush(
                    c.id,
                    c.name,
                    niche,
                    nicheLeads
                      .slice(0, Math.max(1, Math.min(count, available)))
                      .map((l) => l.id),
                  )
                }
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                pushen
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isActive ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => onStatus(c.id, "PAUSED")}
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => onStatus(c.id, "START")}
            >
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => onWebhook(c.id)}
            title="Reply-Webhook registrieren"
          >
            <Webhook className="h-3.5 w-3.5" /> Webhook
          </Button>
          <a
            href={SMARTLEAD_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto"
            title="In Smartlead öffnen"
          >
            <Button size="sm" variant="ghost">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Unbound campaign card (assign a niche) ─────────────────────────────
function UnboundCampaignCard({
  c,
  poolNiches,
  pending,
  onAssign,
}: {
  c: CampaignView;
  poolNiches: { niche: string; count: number }[];
  pending: boolean;
  onAssign: (campaignId: number, niche: string) => void;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            <div className="text-xs text-muted-foreground">
              #{c.id} · {c.status}
            </div>
          </div>
          <a
            href={SMARTLEAD_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="In Smartlead öffnen"
          >
            <Button size="sm" variant="ghost">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          Welche Lead-Niche soll diese Kampagne bekommen? Danach kannst du nur
          noch diese Niche reinpushen.
        </p>
        <Select
          onValueChange={(v) => onAssign(c.id, v)}
          disabled={pending || poolNiches.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Niche zuordnen…" />
          </SelectTrigger>
          <SelectContent>
            {poolNiches.map((n) => (
              <SelectItem key={n.niche} value={n.niche}>
                <span className="capitalize">{n.niche}</span> ({n.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function MergeTagRow({ tag, desc }: { tag: string; desc: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40"
      onClick={() => {
        navigator.clipboard?.writeText(`{{${tag}}}`);
        toast.success(`{{${tag}}} kopiert`);
      }}
    >
      <code className="shrink-0 text-xs text-primary">{`{{${tag}}}`}</code>
      <span className="truncate text-xs text-muted-foreground">{desc}</span>
      <Copy className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/50" />
    </button>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Send;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-md bg-muted/30 p-1.5">
      <Icon className={`mx-auto h-3.5 w-3.5 ${accent ?? "text-muted-foreground"}`} />
      <div className={`mt-0.5 text-sm font-semibold ${accent ?? ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
