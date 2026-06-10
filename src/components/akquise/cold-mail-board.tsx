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
  TriangleAlert,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createSmartleadCampaign,
  pushLeadsToSmartlead,
  registerSmartleadWebhook,
  setSmartleadCampaignStatus,
} from "@/app/(app)/akquise/actions";
import type { PoolLead, ReplyLead } from "@/app/(app)/akquise/mail/page";

type CampaignView = {
  id: number;
  name: string;
  status: string;
  localPushed: number;
  analytics: {
    sent: number;
    opened: number;
    replied: number;
    bounced: number;
    clicked: number;
    unsubscribed: number;
    total: number;
  };
};

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

  const poolCount = poolLeads.length;
  const [campaignId, setCampaignId] = useState<string>(
    campaigns[0] ? String(campaigns[0].id) : "",
  );
  const [count, setCount] = useState<number>(Math.min(poolCount, 25) || 0);
  const [newName, setNewName] = useState("");

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => String(c.id) === campaignId),
    [campaigns, campaignId],
  );

  function handlePush() {
    if (!campaignId) {
      toast.error("Wähle zuerst eine Kampagne");
      return;
    }
    const n = Math.max(1, Math.min(count || 0, poolCount));
    startTransition(async () => {
      try {
        const res = await pushLeadsToSmartlead({
          campaignId: Number(campaignId),
          max: n,
        });
        toast.success(
          `${res.uploaded} gepusht${res.duplicates ? ` · ${res.duplicates} Dups` : ""}${
            res.invalid ? ` · ${res.invalid} ungültig` : ""
          }${res.noEmail ? ` · ${res.noEmail} ohne Mail` : ""}`,
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Push fehlgeschlagen");
      }
    });
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const res = await createSmartleadCampaign(name);
        toast.success(`Kampagne "${res.name}" angelegt (#${res.id})`);
        setNewName("");
        setCampaignId(String(res.id));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
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

  return (
    <Tabs defaultValue="push" className="space-y-4">
      <TabsList>
        <TabsTrigger value="push">Push &amp; Kampagnen</TabsTrigger>
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

      {/* ── PUSH + CAMPAIGNS ─────────────────────────────────────────── */}
      <TabsContent value="push" className="space-y-4">
        {/* Push panel */}
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <h2 className="font-medium">Leads in Kampagne pushen</h2>
              <Badge variant="outline" className="ml-auto border-border/60">
                {poolCount} im Pool
              </Badge>
            </div>

            {poolCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                Kein E-Mail-Lead bereit. Im Lead-Browser Leads auf Channel{" "}
                <strong>E-Mail</strong> setzen (oder Auto-Assign) — dann tauchen
                sie hier auf.
              </p>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kampagne</Label>
                  <Select value={campaignId} onValueChange={setCampaignId}>
                    <SelectTrigger className="w-[260px]">
                      <SelectValue placeholder="Kampagne wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name} · {c.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Anzahl (Top nach Score)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={poolCount}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-28"
                  />
                </div>
                <Button onClick={handlePush} disabled={pending || !campaignId}>
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {count > 0 ? `${Math.min(count, poolCount)} pushen` : "Pushen"}
                </Button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setCount(poolCount)}
                >
                  alle {poolCount}
                </button>
              </div>
            )}

            {selectedCampaign &&
              selectedCampaign.status !== "ACTIVE" &&
              poolCount > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-amber-300/90">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  Kampagne ist {selectedCampaign.status} — Leads landen drin,
                  aber es wird erst gesendet wenn du sie startest.
                </p>
              )}
          </CardContent>
        </Card>

        {/* Pool preview */}
        {poolCount > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Nächste im Pool (Top {Math.min(poolCount, 10)})
              </div>
              <div className="space-y-1">
                {poolLeads.slice(0, 10).map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="font-medium">{l.business_name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {l.owner_email}
                    </span>
                    {l.city && (
                      <span className="text-xs text-muted-foreground/70">
                        {l.city}
                      </span>
                    )}
                    {l.lead_score != null && (
                      <Badge
                        variant="outline"
                        className="ml-auto shrink-0 border-border/60 text-[11px]"
                      >
                        {l.lead_score}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create campaign */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Neue Smartlead-Kampagne</Label>
              <Input
                placeholder="z.B. Friseure Stuttgart – Website"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-[320px]"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleCreate}
              disabled={pending || !newName.trim()}
            >
              <Plus className="h-4 w-4" /> Anlegen
            </Button>
            <p className="text-xs text-muted-foreground">
              Wird als <code>DRAFTED</code> angelegt — Sequenz, Sender &amp;
              Schedule danach in Smartlead einrichten.
            </p>
          </CardContent>
        </Card>

        {/* Campaign cards */}
        {!configured ? null : campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Noch keine Kampagnen. Leg oben eine an oder erstelle sie in
              Smartlead.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                c={c}
                pending={pending}
                onStatus={handleStatus}
                onWebhook={handleWebhook}
              />
            ))}
          </div>
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

function CampaignCard({
  c,
  pending,
  onStatus,
  onWebhook,
}: {
  c: CampaignView;
  pending: boolean;
  onStatus: (id: number, status: "START" | "PAUSED") => void;
  onWebhook: (id: number) => void;
}) {
  const isActive = c.status === "ACTIVE";
  const a = c.analytics;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            <div className="text-xs text-muted-foreground">#{c.id}</div>
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

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{c.localPushed} von hier gepusht</span>
          {a.sent > 0 && (
            <span>
              {Math.round((a.replied / a.sent) * 100)}% Reply-Rate
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
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
        </div>
      </CardContent>
    </Card>
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
