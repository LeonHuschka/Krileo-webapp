import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarDays } from "lucide-react";
import type { OrderRow, UserProfileRow } from "@/lib/types/database";
import { ORDER_TYPES, PRIORITY_COLORS } from "@/lib/constants";
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

  const inner = (
    <Card className="group cursor-pointer space-y-2 border-border/60 bg-card p-3 shadow-none transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 break-words text-sm font-medium leading-tight">
          {order.title}
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 border text-[10px] font-semibold uppercase",
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
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="rounded text-[10px]">
          {typeLabel}
        </Badge>
        {value && <span className="truncate font-medium">{value}</span>}
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
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">
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
