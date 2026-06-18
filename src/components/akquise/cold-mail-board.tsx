"use client";

import { useMemo, useRef, useState, useTransition } from "react";
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
  X,
  Zap,
  Sparkles,
  Save,
  MapPin,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  DEFAULT_SEQUENCE,
  SAMPLE_VARS,
  renderSubject,
  renderTemplate,
  type SequenceMail,
} from "@/lib/smartlead/sequences";
import { BUNDESLAENDER } from "@/lib/akquise/geography";
import type { CampaignAutomation } from "@/lib/smartlead/storage";
import {
  aiEditSequenceAction,
  assignSmartleadCampaignNiche,
  createSmartleadCampaignForNiche,
  pushLeadsToSmartlead,
  pushSequenceToSmartleadAction,
  registerSmartleadWebhook,
  runColdMailAutomationNow,
  saveCampaignSequenceAction,
  setCampaignAutomationAction,
  setSmartleadCampaignStatus,
} from "@/app/(app)/akquise/actions";
import type { PoolLead, ReplyLead } from "@/app/(app)/akquise/mail/page";
import { cn } from "@/lib/utils";

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

function prettyNiche(n: string): string {
  return n.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const EMPTY_AUTOMATION: CampaignAutomation = {
  enabled: false,
  daily_new_leads: 10,
  bundeslaender: [],
  cities: [],
};

export function ColdMailBoard({
  configured,
  campaigns,
  poolLeads,
  replies,
  allNiches,
  automation,
  sequences,
  pushedToday,
}: {
  configured: boolean;
  campaigns: CampaignView[];
  poolLeads: PoolLead[];
  replies: ReplyLead[];
  allNiches: string[];
  automation: Record<string, CampaignAutomation>;
  sequences: Record<string, SequenceMail[]>;
  pushedToday: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{
    running: boolean;
    phase: string;
    label: string;
    generated: number;
    pushed: number;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

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

  const poolCountByNiche = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [n, leads] of Object.entries(poolByNiche)) m[n] = leads.length;
    return m;
  }, [poolByNiche]);

  const assignableNiches = useMemo(() => {
    const set = new Set<string>(allNiches);
    for (const n of poolNiches) set.add(n.niche);
    return Array.from(set).sort();
  }, [allNiches, poolNiches]);

  const boundCampaigns = campaigns.filter((c) => c.niche);
  const unboundCampaigns = campaigns.filter((c) => !c.niche);
  const nichesWithCampaign = new Set(
    boundCampaigns.map((c) => c.niche as string),
  );
  const openNiches = poolNiches.filter((n) => !nichesWithCampaign.has(n.niche));

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
        `${leadIds.length} ${prettyNiche(niche)}-Leads in „${campName}" pushen?`,
      )
    )
      return;
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
      `Name der Smartlead-Kampagne für „${prettyNiche(niche)}":`,
      `${prettyNiche(niche)} – Cold Mail`,
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
        toast.success(`„${res.name}" angelegt & an ${prettyNiche(niche)} gebunden`);
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
        toast.success(`Kampagne an ${prettyNiche(niche)} gebunden`);
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

  function handleSaveAutomation(campaignId: number, a: CampaignAutomation) {
    startTransition(async () => {
      try {
        await setCampaignAutomationAction(campaignId, a);
        toast.success(
          a.enabled
            ? `Auto-Pilot an — ${a.daily_new_leads} neue Leads/Tag`
            : "Auto-Pilot aus",
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
      }
    });
  }

  function handleRunCampaignNow(campaignId: number, name: string) {
    if (
      !window.confirm(
        `Auto-Pilot für „${name}" jetzt ausführen? Holt + qualifiziert frische Leads und pusht das heutige Kontingent. Kann ein paar Minuten dauern.`,
      )
    )
      return;

    setProgress({
      running: true,
      phase: "check",
      label: "Starte …",
      generated: 0,
      pushed: 0,
    });
    // Poll the live progress while the (long) action runs.
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        // Plain GET (not a server action) so it isn't queued behind the
        // long-running run action and can report live progress.
        const res = await fetch("/api/cold-mail/progress", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const p = await res.json();
        setProgress({
          running: p.running,
          phase: p.phase,
          label: p.label,
          generated: p.generated,
          pushed: p.pushed,
        });
        if (!p.running) stopPolling();
      } catch {
        /* keep polling */
      }
    }, 2500);

    startTransition(async () => {
      try {
        const r = await runColdMailAutomationNow(campaignId);
        const c = r.campaigns[0];
        toast.success(
          c
            ? `${c.pushed} gepusht (${c.generated} generiert, heute ${c.pushedBefore + c.pushed}/${c.quota}, ${c.reason})`
            : "Nichts gepusht — Kampagne ohne gespeicherte Einstellungen/Gebiet?",
          { duration: 12_000 },
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Automation fehlgeschlagen");
      } finally {
        stopPolling();
        setProgress((p) => (p ? { ...p, running: false } : p));
      }
    });
  }

  const poolCount = poolLeads.length;

  const PHASE_STEPS = ["check", "scrape", "enrich", "score", "route", "push"];

  return (
    <Tabs defaultValue="push" className="space-y-4">
      {progress && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3 text-sm",
            progress.running
              ? "border-primary/40 bg-primary/10"
              : progress.phase === "error"
                ? "border-rose-500/40 bg-rose-500/10"
                : "border-emerald-500/40 bg-emerald-500/10",
          )}
        >
          {progress.running ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          ) : (
            <span className="text-emerald-300">✓</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{progress.label || "Läuft …"}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {progress.generated} generiert · {progress.pushed} gepusht
              {progress.running &&
                PHASE_STEPS.includes(progress.phase) &&
                ` · Schritt ${PHASE_STEPS.indexOf(progress.phase) + 1}/${PHASE_STEPS.length}`}
            </div>
          </div>
          {!progress.running && (
            <button
              type="button"
              onClick={() => setProgress(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <TabsList>
        <TabsTrigger value="push">Kampagnen</TabsTrigger>
        <TabsTrigger value="sequence" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Sequenz
        </TabsTrigger>
        <TabsTrigger value="replies" className="gap-1.5">
          <Reply className="h-3.5 w-3.5" /> Replies
          {replies.length > 0 && (
            <span className="ml-1 rounded bg-emerald-500/20 px-1.5 text-[11px] text-emerald-300">
              {replies.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="vars">Variablen</TabsTrigger>
      </TabsList>

      {/* ── KAMPAGNEN ────────────────────────────────────────────────── */}
      <TabsContent value="push" className="space-y-6">
        {!configured ? null : (
          <>
            {/* Bound campaigns with control panel */}
            {boundCampaigns.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Kampagnen
                </h2>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {boundCampaigns.map((c) => (
                    <CampaignCard
                      key={c.id}
                      c={c}
                      nicheLeads={poolByNiche[c.niche as string] ?? []}
                      automation={
                        automation[String(c.id)] ?? EMPTY_AUTOMATION
                      }
                      pushedToday={pushedToday[String(c.id)] ?? 0}
                      hasSequence={
                        (sequences[String(c.id)]?.length ?? 0) > 0
                      }
                      pending={pending}
                      onPush={handlePush}
                      onStatus={handleStatus}
                      onWebhook={handleWebhook}
                      onSaveAutomation={handleSaveAutomation}
                      onRunNow={handleRunCampaignNow}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Niches without campaign */}
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

            {/* Unbound campaigns */}
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
                      niches={assignableNiches}
                      poolCount={poolCountByNiche}
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
                  Kein E-Mail-Lead bereit. Leads generieren (Akquise) oder im
                  Lead-Browser Channels zuweisen — dann erscheinen hier pro
                  Niche Cards.
                </CardContent>
              </Card>
            )}
          </>
        )}
      </TabsContent>

      {/* ── SEQUENZ ──────────────────────────────────────────────────── */}
      <TabsContent value="sequence">
        <SequenceEditor
          campaigns={boundCampaigns}
          sequences={sequences}
          poolByNiche={poolByNiche}
        />
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

      {/* ── VARIABLEN ────────────────────────────────────────────────── */}
      <TabsContent value="vars" className="space-y-3">
        <Card>
          <CardContent className="space-y-3 p-5 text-sm">
            <p className="text-muted-foreground">
              Diese Variablen reist jeder Lead automatisch mit. Bau sie in die
              Sequenz ein — der Text bleibt pro Kampagne gleich, füllt sich
              aber pro Lead selbst aus. Fallback-Syntax:{" "}
              <code>{"{{price_range | einem fairen Festpreis}}"}</code>
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {SMARTLEAD_MERGE_TAGS.map((t) => (
                <MergeTagRow key={t.tag} tag={t.tag} desc={t.desc} />
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// ── Sequence editor + live preview + AI ────────────────────────────────
function SequenceEditor({
  campaigns,
  sequences,
  poolByNiche,
}: {
  campaigns: CampaignView[];
  sequences: Record<string, SequenceMail[]>;
  poolByNiche: Record<string, PoolLead[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [campaignId, setCampaignId] = useState<string>(
    campaigns[0] ? String(campaigns[0].id) : "",
  );
  const campaign = campaigns.find((c) => String(c.id) === campaignId);
  const niche = campaign?.niche ?? "";

  const [mails, setMails] = useState<SequenceMail[]>(
    () => sequences[campaignId]?.map((m) => ({ ...m })) ?? DEFAULT_SEQUENCE.map((m) => ({ ...m })),
  );
  const [instruction, setInstruction] = useState("");
  const [previewLeadId, setPreviewLeadId] = useState<string>("__sample__");

  const nichePool = (niche ? poolByNiche[niche] : undefined) ?? [];
  const previewCandidates = nichePool.filter((l) => l.vars);
  const previewVars =
    previewLeadId !== "__sample__"
      ? previewCandidates.find((l) => l.id === previewLeadId)?.vars ?? SAMPLE_VARS
      : SAMPLE_VARS;

  function switchCampaign(id: string) {
    setCampaignId(id);
    setPreviewLeadId("__sample__");
    setMails(
      sequences[id]?.map((m) => ({ ...m })) ??
        DEFAULT_SEQUENCE.map((m) => ({ ...m })),
    );
  }

  function patchMail(i: number, patch: Partial<SequenceMail>) {
    setMails((prev) => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  }

  function save(thenPush: boolean) {
    if (!campaignId) return;
    startTransition(async () => {
      try {
        await saveCampaignSequenceAction(Number(campaignId), mails);
        if (thenPush) {
          await pushSequenceToSmartleadAction(Number(campaignId));
          toast.success("Sequenz gespeichert & in Smartlead übernommen ✓");
        } else {
          toast.success("Sequenz gespeichert");
        }
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `${err.message}${thenPush ? " — Texte ggf. manuell in Smartlead einfügen (Kopieren-Buttons)" : ""}`
            : "Fehler",
        );
      }
    });
  }

  function aiEdit() {
    if (!instruction.trim()) {
      toast.error("Sag Claude, was er ändern soll");
      return;
    }
    startTransition(async () => {
      try {
        const next = await aiEditSequenceAction({
          instruction,
          mails,
          niche: prettyNiche(niche || "allgemein"),
          sampleVars: previewVars,
        });
        setMails(next);
        setInstruction("");
        toast.success("Sequenz überarbeitet — Preview checken, dann speichern");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "AI-Edit fehlgeschlagen");
      }
    });
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Erst eine Kampagne anlegen und an eine Niche binden — dann kannst du
          hier die Sequenz schreiben.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Editor column */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Kampagne</Label>
            <Select value={campaignId} onValueChange={switchCampaign}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} · {c.niche ? prettyNiche(c.niche) : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => save(false)}
          >
            <Save className="h-3.5 w-3.5" /> Speichern
          </Button>
          <Button size="sm" disabled={pending} onClick={() => save(true)}>
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            In Smartlead übernehmen
          </Button>
        </div>

        {campaign?.status === "ACTIVE" && (
          <p className="text-xs text-amber-300/90">
            Kampagne ist ACTIVE — Smartlead lehnt Sequenz-Änderungen ab.
            Erst pausieren, übernehmen, wieder starten.
          </p>
        )}

        {/* AI assist */}
        <Card className="border-violet-500/30 bg-violet-500/[0.04]">
          <CardContent className="space-y-2 p-3">
            <Label className="flex items-center gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              Mit Claude anpassen
            </Label>
            <div className="flex gap-1.5">
              <Input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder='z.B. "Mail 2 kürzer und frecher" oder "alles auf du-Form"'
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    aiEdit();
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 border-violet-500/40 text-violet-200"
                disabled={pending}
                onClick={aiEdit}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {mails.map((m, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-border/60 text-[10px]">
                  Mail {i + 1}
                </Badge>
                <Label className="text-xs text-muted-foreground">Tag +</Label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={m.delay_days}
                  onChange={(e) =>
                    patchMail(i, { delay_days: Number(e.target.value) || 0 })
                  }
                  className="h-7 w-16 text-xs"
                  disabled={i === 0}
                />
                <button
                  type="button"
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  title="Text kopieren (mit Variablen, für Smartlead)"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `Betreff: ${m.subject || "(leer = gleiche Konversation)"}\n\n${m.body}`,
                    );
                    toast.success(`Mail ${i + 1} kopiert`);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                value={m.subject}
                onChange={(e) => patchMail(i, { subject: e.target.value })}
                placeholder={
                  i === 0
                    ? "Betreff…"
                    : "leer = gleiche Konversation (Re: Mail 1)"
                }
                className="h-8 text-xs"
              />
              <Textarea
                value={m.body}
                onChange={(e) => patchMail(i, { body: e.target.value })}
                rows={9}
                className="text-xs leading-relaxed"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview column */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">
            Live-Preview mit echten Lead-Daten
          </Label>
          <Select value={previewLeadId} onValueChange={setPreviewLeadId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__sample__">
                Beispiel-Lead (Demo-Daten)
              </SelectItem>
              {previewCandidates.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.business_name} · {l.owner_email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {previewCandidates.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Noch keine {niche ? prettyNiche(niche) : ""}-Leads im Pool —
              Preview nutzt Demo-Daten. Sobald Leads da sind, siehst du hier
              die echten Mails.
            </p>
          )}
        </div>

        {mails.map((m, i) => (
          <Card key={i} className="border-emerald-500/20">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Tag +{m.delay_days} · an{" "}
                {previewVars.email ?? "lead@beispiel.de"}
              </div>
              <div className="text-sm font-medium">
                {renderSubject(mails, i, previewVars)}
              </div>
              <div className="whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-sm leading-relaxed">
                {renderTemplate(m.body, previewVars)}
              </div>
            </CardContent>
          </Card>
        ))}
        <p className="text-[11px] text-muted-foreground">
          ⟦variable⟧ = Wert fehlt bei diesem Lead und hat keinen Fallback —
          vor dem Start fixen (Fallback-Syntax im Variablen-Tab).
        </p>
      </div>
    </div>
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
      <div className="font-medium">{prettyNiche(niche)}</div>
      <div className="text-xs text-muted-foreground">
        {count} Lead{count === 1 ? "" : "s"} bereit
      </div>
      <div className="text-[11px] text-muted-foreground/70">
        Kampagne anlegen
      </div>
    </button>
  );
}

// ── Bound campaign card with auto-pilot control panel ──────────────────
function CampaignCard({
  c,
  nicheLeads,
  automation,
  pushedToday,
  hasSequence,
  pending,
  onPush,
  onStatus,
  onWebhook,
  onSaveAutomation,
  onRunNow,
}: {
  c: CampaignView;
  nicheLeads: PoolLead[];
  automation: CampaignAutomation;
  pushedToday: number;
  hasSequence: boolean;
  pending: boolean;
  onPush: (
    campaignId: number,
    campName: string,
    niche: string,
    leadIds: string[],
  ) => void;
  onStatus: (id: number, status: "START" | "PAUSED") => void;
  onWebhook: (id: number) => void;
  onSaveAutomation: (id: number, a: CampaignAutomation) => void;
  onRunNow: (id: number, name: string) => void;
}) {
  const available = nicheLeads.length;
  const [count, setCount] = useState<number>(Math.min(available, 25) || 0);
  const isActive = c.status === "ACTIVE";
  const a = c.analytics;
  const niche = c.niche as string;

  // Local automation draft
  const [auto, setAuto] = useState<CampaignAutomation>({ ...automation });
  const [showRegion, setShowRegion] = useState(false);
  const [draftCity, setDraftCity] = useState("");
  const dirty =
    auto.enabled !== automation.enabled ||
    auto.daily_new_leads !== automation.daily_new_leads ||
    JSON.stringify(auto.bundeslaender) !==
      JSON.stringify(automation.bundeslaender) ||
    JSON.stringify(auto.cities) !== JSON.stringify(automation.cities);
  const hasScope = auto.bundeslaender.length > 0 || auto.cities.length > 0;

  return (
    <Card className={auto.enabled ? "border-emerald-500/30" : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{c.name}</span>
              <Badge
                variant="outline"
                className="shrink-0 border-primary/40 bg-primary/10 text-[10px] text-primary"
              >
                {prettyNiche(niche)}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              #{c.id} · {c.localPushed} gepusht gesamt
              {!hasSequence && " · ⚠ keine Sequenz gespeichert"}
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

        {/* Auto-pilot control panel */}
        <div
          className={`space-y-2 rounded-md border p-2.5 ${
            auto.enabled
              ? "border-emerald-500/30 bg-emerald-500/[0.05]"
              : "border-border/50 bg-muted/20"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox
              id={`auto-${c.id}`}
              checked={auto.enabled}
              onCheckedChange={(v) =>
                setAuto({ ...auto, enabled: v === true })
              }
            />
            <Label
              htmlFor={`auto-${c.id}`}
              className="flex cursor-pointer items-center gap-1 text-xs font-medium"
            >
              <Zap
                className={`h-3.5 w-3.5 ${auto.enabled ? "text-emerald-300" : "text-muted-foreground"}`}
              />
              Auto-Pilot
            </Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={auto.daily_new_leads}
              onChange={(e) =>
                setAuto({
                  ...auto,
                  daily_new_leads: Number(e.target.value) || 0,
                })
              }
              className="h-7 w-16 text-xs"
            />
            <span className="text-[11px] text-muted-foreground">
              neue/Tag · heute {pushedToday}/{auto.daily_new_leads}
            </span>
            <button
              type="button"
              onClick={() => setShowRegion(!showRegion)}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              <MapPin className="h-3 w-3" />
              Gebiet ({auto.bundeslaender.length + auto.cities.length})
            </button>
            {!dirty && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1 border-emerald-500/40 px-2 text-[11px] text-emerald-300"
                disabled={pending}
                onClick={() => onRunNow(c.id, c.name)}
                title="Heutiges Kontingent jetzt holen + pushen (Test-Lauf, auch ohne Auto-Pilot)"
              >
                <Play className="h-3 w-3" /> Jetzt
              </Button>
            )}
            {dirty && (
              <Button
                size="sm"
                className="h-6 px-2 text-[11px]"
                disabled={pending || (auto.enabled && !hasScope)}
                onClick={() => onSaveAutomation(c.id, auto)}
              >
                <Save className="h-3 w-3" /> Speichern
              </Button>
            )}
          </div>

          {auto.enabled && !hasScope && (
            <p className="text-[11px] text-amber-300/90">
              Gebiet wählen (Bundesland oder Stadt), sonst kann nichts
              generiert werden.
            </p>
          )}

          {showRegion && (
            <div className="space-y-2 border-t border-border/40 pt-2">
              <div className="flex flex-wrap gap-1">
                {BUNDESLAENDER.map((bl) => {
                  const on = auto.bundeslaender.includes(bl);
                  return (
                    <button
                      key={bl}
                      type="button"
                      onClick={() =>
                        setAuto({
                          ...auto,
                          bundeslaender: on
                            ? auto.bundeslaender.filter((x) => x !== bl)
                            : [...auto.bundeslaender, bl],
                        })
                      }
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
              <div className="flex gap-1">
                <Input
                  value={draftCity}
                  onChange={(e) => setDraftCity(e.target.value)}
                  placeholder="Einzelne Stadt/Ort…"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = draftCity.trim();
                      if (v && !auto.cities.includes(v)) {
                        setAuto({ ...auto, cities: [...auto.cities, v] });
                      }
                      setDraftCity("");
                    }
                  }}
                />
              </div>
              {auto.cities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {auto.cities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() =>
                        setAuto({
                          ...auto,
                          cities: auto.cities.filter((x) => x !== city),
                        })
                      }
                      className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      {city}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual push (scoped to this campaign's niche) */}
        <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
          {available === 0 ? (
            <p className="text-xs text-muted-foreground">
              Keine neuen {prettyNiche(niche)}-Leads im Pool.
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

// ── Unbound campaign card ──────────────────────────────────────────────
function UnboundCampaignCard({
  c,
  niches,
  poolCount,
  pending,
  onAssign,
}: {
  c: CampaignView;
  niches: string[];
  poolCount: Record<string, number>;
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
          disabled={pending || niches.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Niche zuordnen…" />
          </SelectTrigger>
          <SelectContent>
            {niches.map((n) => (
              <SelectItem key={n} value={n}>
                {prettyNiche(n)}
                {poolCount[n] ? ` · ${poolCount[n]} im Pool` : ""}
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
