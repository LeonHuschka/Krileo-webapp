import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarDays } from "lucide-react";
import type { OrderRow, UserProfileRow } from "@/lib/types/database";
import {
  ORDER_STATUS_COLUMN,
  ORDER_TYPES,
  ORDER_TYPE_COLORS,
  PRIORITY_COLORS,
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

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
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
  const due = formatDate(order.due_date);
  const value = formatValue(order.value_cents);
  const statusCol = ORDER_STATUS_COLUMN[order.status];

  const inner = (
    <Card className="group relative cursor-pointer space-y-2 overflow-hidden border-border/60 bg-card p-3 pl-3.5 shadow-none transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
      <div
        className={cn(
          "absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b",
          statusCol.bar,
        )}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 break-words text-sm font-semibold leading-tight">
          {order.title}
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 border text-[10px] font-semibold uppercase tracking-wide",
            PRIORITY_COLORS[order.priority],
          )}
        >
          {order.priority}
        </Badge>
      </div>
      {order.client_name && (
        <div className="truncate text-xs text-muted-foreground">
          {order.client_name}
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
        {due ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {due}
          </div>
        ) : (
          <span />
        )}
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
