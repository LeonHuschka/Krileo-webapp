"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Trash2,
  ExternalLink,
  GitCommit,
  RefreshCw,
  Loader2,
  Ban,
  RotateCcw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ORDER_PRIORITIES,
  ORDER_STATUSES,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_DOTS,
  ORDER_TYPES,
  workThumbnailUrl,
  daysSinceLabel,
} from "@/lib/constants";
import {
  deleteOrder,
  updateOrder,
  setOrderCanceled,
} from "@/app/(app)/orders/actions";
import { NotesPanel } from "@/components/orders/notes-panel";
import { ReviewPanel } from "@/components/orders/review-panel";
import { DevItemsPanel } from "@/components/orders/dev-items-panel";
import { AttachmentsPanel } from "@/components/orders/attachments-panel";
import { DeliveredPanel } from "@/components/orders/delivered-panel";
import { AccessPanel } from "@/components/orders/access-panel";
import type { AccessClient } from "@/lib/orders/access";
import type {
  ContactRow,
  OrderEventRow,
  OrderRow,
  OrderStatus,
  TelegramReviewSuggestionRow,
  UserProfileRow,
} from "@/lib/types/database";
import { ReviewSuggestions } from "@/components/orders/review-suggestions";
import { InvoiceButton } from "@/components/orders/invoice-editor";
import type { InvoiceState } from "@/lib/invoice/types";
import type { DeploymentStatus, DeploymentState } from "@/lib/orders/vercel";
import { ORDER_TABS, statusToTab, type OrderTabKey } from "@/lib/orders/tabs";
import { cn } from "@/lib/utils";

const NONE = "__none__";

function relTime(input: string | number): string {
  const mins = Math.floor((Date.now() - new Date(input).getTime()) / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std`;
  return `vor ${Math.floor(hrs / 24)} Tagen`;
}

const DEPLOY_UI: Record<
  DeploymentState,
  { label: string; text: string; dot: string; pulse: boolean }
> = {
  READY: {
    label: "Live · Deployment aktuell",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    pulse: false,
  },
  BUILDING: {
    label: "Deployment läuft · daran wird gearbeitet",
    text: "text-amber-300",
    dot: "bg-amber-400",
    pulse: true,
  },
  INITIALIZING: {
    label: "Deployment startet",
    text: "text-amber-300",
    dot: "bg-amber-400",
    pulse: true,
  },
  QUEUED: {
    label: "In Warteschlange",
    text: "text-amber-300",
    dot: "bg-amber-400",
    pulse: true,
  },
  ERROR: {
    label: "Letztes Deployment fehlgeschlagen",
    text: "text-rose-300",
    dot: "bg-rose-400",
    pulse: false,
  },
  CANCELED: {
    label: "Deployment abgebrochen",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
    pulse: false,
  },
  UNKNOWN: {
    label: "Deployment-Status unbekannt",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
    pulse: false,
  },
};

function DeploymentBlock({ d }: { d: DeploymentStatus }) {
  const ui = DEPLOY_UI[d.state];
  const commitLine = d.commitMessage?.split("\n")[0] ?? null;
  return (
    <div className="space-y-1.5 rounded-lg border border-border/50 bg-background/40 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          {ui.pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                ui.dot,
              )}
            />
          )}
          <span
            className={cn("relative inline-flex h-2 w-2 rounded-full", ui.dot)}
          />
        </span>
        <span className={cn("text-sm font-medium", ui.text)}>{ui.label}</span>
        {d.createdAt && (
          <span className="text-[11px] text-muted-foreground">
            · {relTime(d.createdAt)}
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {d.projectName}
        </span>
      </div>
      {commitLine && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <GitCommit className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0 break-words">{commitLine}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-3 pt-0.5 text-[11px]">
        {d.inspectorUrl && (
          <a
            href={d.inspectorUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Vercel öffnen
          </a>
        )}
        {d.productionUrl && (
          <a
            href={d.productionUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Live-Seite
          </a>
        )}
      </div>
    </div>
  );
}

/** Live preview shown as a MacBook + iPhone device mockup, both linking out.
 *  Sources are the uploaded real screenshots when present, else the auto render.
 *  `size` controls how large the mockup renders (full in Auftrag, compact
 *  everywhere else). */
function WorkPreview({
  url,
  desktopSrc,
  mobileSrc,
  size = "full",
}: {
  url: string;
  desktopSrc: string;
  mobileSrc: string;
  size?: "full" | "compact";
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full pb-5",
        size === "compact" ? "max-w-[520px]" : "max-w-[770px]",
      )}
    >
      {/* MacBook — screen + aluminium base */}
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="group block w-[85%]"
        title="Desktop-Ansicht öffnen"
      >
        <div className="relative overflow-hidden rounded-t-[12px] border-[9px] border-b-0 border-zinc-900 bg-zinc-900">
          <span className="absolute left-1/2 top-[3px] z-10 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-zinc-600" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={desktopSrc}
            alt="Desktop-Vorschau des Arbeits-Links"
            className="block aspect-[16/10] w-full object-cover object-top transition-transform group-hover:scale-[1.01]"
          />
        </div>
        <div className="relative left-1/2 h-[13px] w-[112%] -translate-x-1/2 rounded-b-[10px] bg-gradient-to-b from-zinc-300 to-zinc-400 shadow-md">
          <span className="absolute left-1/2 top-0 h-[5px] w-[15%] -translate-x-1/2 rounded-b-[7px] bg-zinc-400" />
        </div>
      </a>

      {/* iPhone — overlapping the laptop's lower-right */}
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="absolute bottom-0 right-0 z-10 w-[27%] min-w-[104px] max-w-[152px] transition-transform hover:-translate-y-0.5"
        title="Mobil-Ansicht öffnen"
      >
        <div className="relative overflow-hidden rounded-[1.9rem] border-[6px] border-zinc-900 bg-zinc-900 shadow-2xl ring-1 ring-black/20">
          <span className="absolute left-1/2 top-0 z-10 h-[13px] w-[40%] -translate-x-1/2 rounded-b-[10px] bg-zinc-900" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mobileSrc}
            alt="Mobil-Vorschau des Arbeits-Links"
            className="block aspect-[9/19.5] w-full object-cover object-top"
          />
          <span className="absolute bottom-[5px] left-1/2 h-1 w-1/4 -translate-x-1/2 rounded-full bg-white/70" />
        </div>
      </a>
    </div>
  );
}

export function OrderDetail({
  order,
  accesses,
  members,
  contacts,
  deployment,
  events,
  avgLeadMs,
  reviewSuggestions,
  defaultTab,
}: {
  order: OrderRow;
  accesses: AccessClient[];
  members: UserProfileRow[];
  contacts: ContactRow[];
  deployment?: DeploymentStatus | null;
  events: OrderEventRow[];
  avgLeadMs: number;
  reviewSuggestions: TelegramReviewSuggestionRow[];
  defaultTab: OrderTabKey;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [capturing, setCapturing] = useState(false);
  const [tab, setTab] = useState<string>(defaultTab);
  const [draft, setDraft] = useState({
    title: order.title,
    client_name: order.client_name ?? "",
    value_cents: order.value_cents,
    work_url: order.work_url ?? "",
  });

  function selectTab(v: string) {
    setTab(v);
    if (typeof window !== "undefined")
      window.history.replaceState(null, "", `?tab=${v}`);
  }

  function patch(values: Record<string, unknown>) {
    startTransition(async () => {
      try {
        await updateOrder(order.id, values);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  // Capture real desktop + iPhone screenshots server-side (microlink).
  async function capture() {
    setCapturing(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/capture-preview`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Aufnahme fehlgeschlagen");
      }
      toast.success("Screenshots aufgenommen");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setCapturing(false);
    }
  }

  function saveTextFields() {
    const nextWorkUrl = draft.work_url.trim() || null;
    const workUrlChanged = nextWorkUrl !== (order.work_url ?? null);
    startTransition(async () => {
      try {
        await updateOrder(order.id, {
          title: draft.title,
          client_name: draft.client_name || null,
          value_cents: draft.value_cents,
          work_url: nextWorkUrl,
        });
        router.refresh();
        // New/changed link → grab real screenshots automatically.
        if (workUrlChanged && nextWorkUrl) void capture();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function remove() {
    if (!confirm("Auftrag wirklich löschen? Alle To-Dos werden mitgelöscht."))
      return;
    startTransition(async () => {
      try {
        await deleteOrder(order.id);
        toast.success("Auftrag gelöscht");
        router.push("/orders");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const canceled = !!order.canceled_at;
  function toggleCanceled() {
    startTransition(async () => {
      try {
        await setOrderCanceled(order.id, !canceled);
        toast.success(canceled ? "Auftrag reaktiviert" : "Auftrag storniert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const detailsGrid = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={order.status}
          onValueChange={(v) => patch({ status: v as OrderStatus })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Priorität</Label>
        <Select
          value={order.priority}
          onValueChange={(v) => patch({ priority: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Typ</Label>
        <Select
          value={order.order_type}
          onValueChange={(v) => patch({ order_type: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Verantwortlich</Label>
        <Select
          value={order.assigned_to ?? NONE}
          onValueChange={(v) => patch({ assigned_to: v === NONE ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="— niemand —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— niemand —</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name || m.id.slice(0, 6)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Kunden-Name</Label>
        <Input
          value={draft.client_name}
          onChange={(e) => setDraft({ ...draft, client_name: e.target.value })}
          onBlur={saveTextFields}
          placeholder="Mustermann GmbH"
        />
      </div>

      <div className="space-y-2">
        <Label>Kontakt</Label>
        <Select
          value={order.contact_id ?? NONE}
          onValueChange={(v) => patch({ contact_id: v === NONE ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="— keiner —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— keiner —</SelectItem>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` · ${c.company}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Wert (€)</Label>
        <Input
          type="number"
          min={0}
          defaultValue={draft.value_cents != null ? draft.value_cents / 100 : ""}
          onBlur={(e) => {
            const n = e.target.valueAsNumber;
            const cents = Number.isFinite(n) ? Math.round(n * 100) : null;
            if (cents !== order.value_cents) patch({ value_cents: cents });
          }}
        />
      </div>
    </div>
  );

  // The device preview lives inside each tab: full & slightly larger in Auftrag,
  // compact everywhere else (link field only shown when no link is set yet).
  const previewArea = (compact: boolean, rightSlot?: React.ReactNode) => {
    const hasLink = !!order.work_url;
    const linkField = (
      <div className="space-y-1.5">
        <Label className="text-xs">Arbeits-Link (Demo / Staging)</Label>
        <div className="flex items-center gap-2">
          <Input
            value={draft.work_url}
            onChange={(e) => setDraft({ ...draft, work_url: e.target.value })}
            onBlur={saveTextFields}
            placeholder="https://demo.krileo.de/kunde"
          />
          {hasLink && (
            <Button asChild variant="outline" size="icon" title="Öffnen">
              <a
                href={order.work_url ?? "#"}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    );

    if (compact) {
      const device = hasLink ? (
        <WorkPreview
          url={order.work_url ?? ""}
          size="compact"
          desktopSrc={
            order.preview_desktop_url ||
            workThumbnailUrl(order.work_url ?? "", 800, "desktop")
          }
          mobileSrc={
            order.preview_mobile_url ||
            workThumbnailUrl(order.work_url ?? "", 420, "mobile")
          }
        />
      ) : (
        linkField
      );
      return (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          {rightSlot ? (
            // Device stays centered at its original size (equal side columns);
            // the access panel fills the free space on the right.
            <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
              <div className="hidden lg:block" />
              <div>{device}</div>
              <div className="lg:justify-self-stretch">{rightSlot}</div>
            </div>
          ) : (
            device
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
        {linkField}
        {hasLink ? (
          <div className="space-y-2.5">
            <WorkPreview
              url={order.work_url ?? ""}
              size="full"
              desktopSrc={
                order.preview_desktop_url ||
                workThumbnailUrl(order.work_url ?? "", 1200, "desktop")
              }
              mobileSrc={
                order.preview_mobile_url ||
                workThumbnailUrl(order.work_url ?? "", 420, "mobile")
              }
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={capture}
                disabled={capturing}
                className="h-7 gap-1 text-[11px]"
              >
                {capturing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {capturing ? "Nehme auf…" : "Screenshots aktualisieren"}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Echte Desktop- & iPhone-Aufnahme, automatisch.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 text-xs text-muted-foreground/60">
            Link eintragen → Desktop- & Mobil-Vorschau erscheinen hier
          </div>
        )}
        {deployment && <DeploymentBlock d={deployment} />}
      </div>
    );
  };

  // Header (title + badges + actions) — only rendered inside the Auftrag tab.
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex-1 space-y-2">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onBlur={saveTextFields}
              className="border-none bg-transparent px-0 text-xl font-semibold focus-visible:ring-0 md:text-2xl"
            />
            <div className="flex flex-wrap items-center gap-2">
              {canceled && (
                <Badge className="border-rose-500/40 bg-rose-500/15 text-rose-300">
                  Storniert
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn("border", ORDER_STATUS_COLORS[order.status])}
              >
                {ORDER_STATUSES.find((s) => s.value === order.status)?.label}
              </Badge>
              <Badge variant="secondary">
                {ORDER_TYPES.find((t) => t.value === order.order_type)?.label}
              </Badge>
              {order.priority !== "medium" && (
                <Badge variant="secondary" className="capitalize">
                  {order.priority === "high" ? "Hoch" : "Niedrig"}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Auftrag {daysSinceLabel(order.created_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <InvoiceButton
              orderId={order.id}
              orderType={order.order_type}
              initialInvoice={
                (order.invoice as unknown as InvoiceState | null) ?? null
              }
            />
            <Button
              variant="outline"
              size="sm"
              onClick={toggleCanceled}
              disabled={pending}
              className={cn(
                "gap-1.5",
                canceled
                  ? "text-emerald-300 hover:text-emerald-200"
                  : "text-muted-foreground hover:text-rose-300",
              )}
              title={
                canceled ? "Auftrag wieder aktivieren" : "Auftrag stornieren"
              }
            >
              {canceled ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" /> Reaktivieren
                </>
              ) : (
                <>
                  <Ban className="h-3.5 w-3.5" /> Stornieren
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              title="Auftrag löschen"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
    </div>
  );

  const statusTab = statusToTab(order.status);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={selectTab} className="w-full">
        <TabsList className="flex h-auto w-full gap-1.5 rounded-2xl border border-border/60 bg-card/60 p-1.5 backdrop-blur">
          {ORDER_TABS.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="flex-1 gap-1.5 rounded-xl py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {t.key === statusTab && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    ORDER_STATUS_DOTS[order.status],
                  )}
                  title="Aktueller Status"
                />
              )}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="auftrag" className="space-y-4">
          {header}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.05fr_1fr]">
            <div>{previewArea(false)}</div>
            <div className="space-y-4">
              <NotesPanel
                orderId={order.id}
                initialNotes={order.description ?? ""}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Details</CardTitle>
                </CardHeader>
                <CardContent>{detailsGrid}</CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="aktiv" className="space-y-4">
          {previewArea(
            true,
            <AccessPanel orderId={order.id} accesses={accesses} />,
          )}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <DevItemsPanel
              orderId={order.id}
              initialItems={order.dev_items ?? []}
            />
            <AttachmentsPanel
              orderId={order.id}
              initialAttachments={order.attachments ?? []}
            />
          </div>
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          {previewArea(true)}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
            <ReviewPanel
              orderId={order.id}
              initialReview={order.review ?? null}
            />
            <ReviewSuggestions
              orderId={order.id}
              suggestions={reviewSuggestions}
              reviewChatId={order.telegram_review_chat_id}
            />
          </div>
        </TabsContent>

        <TabsContent value="geliefert" className="space-y-4">
          {previewArea(true)}
          <DeliveredPanel
            order={order}
            events={events}
            avgLeadMs={avgLeadMs}
          />
        </TabsContent>

        <TabsContent value="archiv" className="space-y-4">
          {previewArea(true)}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Archiv & Stornierung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canceled ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
                  <span className="font-medium text-rose-300">Storniert</span>
                  {order.canceled_at && (
                    <span className="text-muted-foreground">
                      {" "}
                      · am{" "}
                      {new Date(order.canceled_at).toLocaleDateString("de-DE")}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nicht storniert. Über den Stornieren-Button im Auftrag-Tab
                  markierst du den Auftrag als abgebrochen (zählt dann nicht mehr
                  zum Umsatz).
                </p>
              )}

              <div className="space-y-2">
                <Label>Verbleib</Label>
                <Select
                  value={order.cancellation_type ?? NONE}
                  onValueChange={(v) =>
                    patch({ cancellation_type: v === NONE ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— offen —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— offen —</SelectItem>
                    <SelectItem value="permanent">Endgültig vorbei</SelectItem>
                    <SelectItem value="temporary">Nur vorübergehend</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Grund</Label>
                <Textarea
                  rows={3}
                  defaultValue={order.cancellation_reason ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (order.cancellation_reason ?? ""))
                      patch({ cancellation_reason: v || null });
                  }}
                  placeholder="Warum wurde der Auftrag archiviert/storniert? Wie ist man verblieben?"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Übersicht</CardTitle>
            </CardHeader>
            <CardContent>{detailsGrid}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
