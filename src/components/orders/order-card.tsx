import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Camera } from "lucide-react";
import type { OrderRow, UserProfileRow } from "@/lib/types/database";
import {
  ORDER_STATUS_COLUMN,
  ORDER_TYPES,
  ORDER_TYPE_COLORS,
  PRIORITY_COLORS,
  LIVE_STATUS_FRESH_MS,
  workThumbnailUrl,
  daysSinceLabel,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

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
  asLink = true,
}: {
  order: OrderRow;
  assignee?: UserProfileRow | null;
  asLink?: boolean;
}) {
  const typeLabel =
    ORDER_TYPES.find((t) => t.value === order.order_type)?.label ?? "—";
  const value = formatValue(order.value_cents);
  const statusCol = ORDER_STATUS_COLUMN[order.status];
  // Priority is only surfaced when it's been manually set away from "mittel".
  const showPriority = order.priority !== "medium";
  const isLive =
    !!order.live_status_at &&
    Date.now() - new Date(order.live_status_at).getTime() < LIVE_STATUS_FRESH_MS;

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
            src={workThumbnailUrl(order.work_url, 640)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top"
          />
          <div className="pointer-events-none absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground backdrop-blur">
            <Camera className="h-2.5 w-2.5" /> Live-Vorschau
          </div>
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

      {isLive && (
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="truncate">{order.live_status}</span>
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
