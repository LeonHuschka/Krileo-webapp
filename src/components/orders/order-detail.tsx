"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, FileDown, ExternalLink, Camera, GitCommit } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ORDER_TYPES,
  workThumbnailUrl,
  daysSinceLabel,
} from "@/lib/constants";
import { deleteOrder, updateOrder } from "@/app/(app)/orders/actions";
import type {
  ContactRow,
  OrderRow,
  OrderStatus,
  UserProfileRow,
} from "@/lib/types/database";
import type { DeploymentStatus, DeploymentState } from "@/lib/orders/vercel";
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

export function OrderDetail({
  order,
  members,
  contacts,
  deployment,
}: {
  order: OrderRow;
  members: UserProfileRow[];
  contacts: ContactRow[];
  deployment?: DeploymentStatus | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    title: order.title,
    client_name: order.client_name ?? "",
    value_cents: order.value_cents,
    work_url: order.work_url ?? "",
  });

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

  function saveTextFields() {
    patch({
      title: draft.title,
      client_name: draft.client_name || null,
      value_cents: draft.value_cents,
      work_url: draft.work_url.trim() || null,
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex-1 space-y-2">
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onBlur={saveTextFields}
            className="border-none bg-transparent px-0 text-xl font-semibold focus-visible:ring-0 md:text-2xl"
          />
          <div className="flex flex-wrap items-center gap-2">
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
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5"
            title="Rechnung als PDF herunterladen"
          >
            <a href={`/api/orders/${order.id}/invoice`} download>
              <FileDown className="h-3.5 w-3.5" />
              Rechnung
            </a>
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
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Work link + live preview + Claude Code live status */}
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs">Arbeits-Link (Demo / Staging)</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={draft.work_url}
                  onChange={(e) =>
                    setDraft({ ...draft, work_url: e.target.value })
                  }
                  onBlur={saveTextFields}
                  placeholder="https://demo.krileo.de/kunde"
                />
                {order.work_url && (
                  <Button asChild variant="outline" size="icon" title="Öffnen">
                    <a
                      href={order.work_url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {order.work_url ? (
            <a
              href={order.work_url}
              target="_blank"
              rel="noreferrer noopener"
              className="group relative block aspect-[16/9] overflow-hidden rounded-lg border border-border/60 bg-muted/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={workThumbnailUrl(order.work_url, 1200)}
                alt="Live-Vorschau des Arbeits-Links"
                className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.02]"
              />
              <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-md bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur">
                <Camera className="h-3 w-3" /> Live-Vorschau
              </div>
            </a>
          ) : (
            <div className="flex aspect-[16/9] items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 text-xs text-muted-foreground/60">
              Link eintragen → automatische Vorschau erscheint hier
            </div>
          )}

          {/* Live deployment status from Vercel (automatic) */}
          {deployment && <DeploymentBlock d={deployment} />}
        </div>

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
              onChange={(e) =>
                setDraft({ ...draft, client_name: e.target.value })
              }
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
              defaultValue={
                draft.value_cents != null ? draft.value_cents / 100 : ""
              }
              onBlur={(e) => {
                const n = e.target.valueAsNumber;
                const cents = Number.isFinite(n) ? Math.round(n * 100) : null;
                if (cents !== order.value_cents) patch({ value_cents: cents });
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
