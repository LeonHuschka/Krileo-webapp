import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, History, RotateCcw } from "lucide-react";
import type { OrderRow, UserProfileRow } from "@/lib/types/database";
import type { DeploymentState } from "@/lib/orders/vercel";
import {
  ORDER_STATUS_COLUMN,
  ORDER_TYPES,
  ORDER_TYPE_COLORS,
  PRIORITY_COLORS,
  workThumbnailUrl,
  daysSinceLabel,
  shortAgo,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export type CardDeployment = {
  state: DeploymentState;
  createdAt: number | null;
};

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatValue(cents: number | null) {
  if (cents == null) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function OrderCard({
  order,
  assignee,
  deployment,
  asLink = true,
}: {
  order: OrderRow;
  assignee?: UserProfileRow | null;
  deployment?: CardDeployment | null;
  asLink?: boolean;
}) {
  const typeLabel =
    ORDER_TYPES.find((t) => t.value === order.order_type)?.label ?? "—";
  const value = formatValue(order.value_cents);
  const statusCol = ORDER_STATUS_COLUMN[order.status];
  // Priority is only surfaced when it's been manually set away from "mittel".
  const showPriority = order.priority !== "medium";
  // Open change requests bounced back from review (only while in Aktiv).
  const reviewOpen =
    order.status === "aktiv"
      ? (order.review?.items ?? []).filter((i) => !i.done).length
      : 0;

  const building =
    !!deployment &&
    ["BUILDING", "QUEUED", "INITIALIZING"].includes(deployment.state);
  const changedLabel = deployment?.createdAt ? shortAgo(deployment.createdAt) : null;

  const inner = (
    <Card className="group relative cursor-pointer space-y-2 overflow-hidden border-border/60 bg-card p-3 pl-3.5 shadow-none transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
      <div
        className={cn(
          "absolute inset-y-2 left-0 z-10 w-1 rounded-r-full bg-gradient-to-b",
          statusCol.bar,
        )}
      />

      {order.work_url && (
        <div className="relative -mx-3 -mt-3 mb-1 aspect-[16/9] overflow-hidden border-b border-border/60 bg-muted/40">
          {/* Live screenshot of the work link. Plain img so no next/image allowlist. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              order.preview_desktop_url ||
              workThumbnailUrl(order.work_url, 640)
            }
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top"
          />
          {(building || changedLabel) && (
            <div className="pointer-events-none absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-background/75 px-1.5 py-0.5 text-[9px] font-medium backdrop-blur">
              {building ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                  </span>
                  <span className="text-amber-300">baut…</span>
                </>
              ) : (
                <>
                  <History className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{changedLabel}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 break-words text-sm font-semibold leading-tight">
          {order.title}
        </div>
        {showPriority && (
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 border text-[10px] font-semibold uppercase tracking-wide",
              PRIORITY_COLORS[order.priority],
            )}
          >
            {order.priority === "high" ? "Hoch" : "Niedrig"}
          </Badge>
        )}
      </div>

      {order.client_name && (
        <div className="truncate text-xs text-muted-foreground">
          {order.client_name}
        </div>
      )}

      {reviewOpen > 0 && (
        <div className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300">
          <RotateCcw className="h-3 w-3 shrink-0" />
          Review: {reviewOpen} offen
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge
          variant="outline"
          className={cn(
            "border text-[10px] font-medium",
            ORDER_TYPE_COLORS[order.order_type],
          )}
        >
          {typeLabel}
        </Badge>
        {value && (
          <span className="ml-auto truncate text-xs font-bold tracking-tight text-foreground">
            {value}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <div
          className="flex items-center gap-1 text-xs text-muted-foreground"
          title={`Auftrag seit ${new Date(order.created_at).toLocaleDateString("de-DE")}`}
        >
          <Clock className="h-3 w-3" />
          {daysSinceLabel(order.created_at)}
        </div>
        {assignee && (
          <Avatar className="h-6 w-6 ring-1 ring-border">
            <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-[10px] font-semibold text-foreground">
              {initials(assignee.full_name)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </Card>
  );

  if (!asLink) return inner;
  return (
    <Link href={`/orders/${order.id}`} className="block">
      {inner}
    </Link>
  );
}
