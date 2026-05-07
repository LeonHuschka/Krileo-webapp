import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ClipboardList, Users, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  CONTACT_STATUS_COLORS,
  CONTACT_STATUSES,
  ORDER_STATUSES,
  ORDER_STATUS_COLORS,
} from "@/lib/constants";
import type {
  ContactRow,
  OrderRow,
  OrderStatus,
  OrderTodoRow,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  if (day !== 1) date.setHours(-24 * (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: orders }, { data: todos }, { data: contacts }] =
    await Promise.all([
      supabase.from("orders").select("*"),
      supabase
        .from("order_todos")
        .select("*")
        .eq("done", false)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

  const allOrders = (orders ?? []) as OrderRow[];
  const openOrders = allOrders.filter((o) => o.status !== "archiv");
  const myOpenOrders = openOrders.filter(
    (o) => o.assigned_to === user?.id || o.created_by === user?.id,
  );
  const myTodos = (todos ?? []).filter(
    (t: OrderTodoRow) => t.assigned_to === user?.id || t.assigned_to == null,
  );
  const allContacts = (contacts ?? []) as ContactRow[];

  const weekStart = startOfWeek();
  const newLeads = allContacts.filter(
    (c) => new Date(c.created_at) >= weekStart,
  );
  const wonContacts = allContacts.filter((c) => c.status === "won").length;

  const counts: Record<OrderStatus, number> = {
    angebot: 0,
    aktiv: 0,
    review: 0,
    geliefert: 0,
    archiv: 0,
  };
  allOrders.forEach((o) => {
    counts[o.status] += 1;
  });
  const totalForBar =
    counts.angebot + counts.aktiv + counts.review;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Überblick über Aufträge, To-Dos und Acquisition
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Offene Aufträge
              </span>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {openOrders.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Meine</span>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {myOpenOrders.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Neue Leads (Woche)
              </span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-semibold">{newLeads.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Gewonnen</span>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-semibold">{wonContacts}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pipeline</CardTitle>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Zum Board <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {(["angebot", "aktiv", "review"] as OrderStatus[]).map((s) => {
                const pct = totalForBar ? (counts[s] / totalForBar) * 100 : 0;
                return (
                  <div
                    key={s}
                    style={{ width: `${pct}%` }}
                    className={cn(
                      s === "angebot" && "bg-blue-500",
                      s === "aktiv" && "bg-violet-500",
                      s === "review" && "bg-amber-500",
                    )}
                  />
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs sm:grid-cols-3">
              {ORDER_STATUSES.map((s) => (
                <div key={s.value} className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "border text-[10px] capitalize",
                      ORDER_STATUS_COLORS[s.value],
                    )}
                  >
                    {s.label}
                  </Badge>
                  <span className="text-muted-foreground">
                    {counts[s.value]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acquisition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {CONTACT_STATUSES.map((s) => {
              const n = allContacts.filter((c) => c.status === s.value).length;
              return (
                <div
                  key={s.value}
                  className="flex items-center justify-between rounded-md border border-border/50 bg-card px-3 py-2 text-sm"
                >
                  <Badge
                    variant="outline"
                    className={cn("border", CONTACT_STATUS_COLORS[s.value])}
                  >
                    {s.label}
                  </Badge>
                  <span className="font-medium">{n}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meine offenen To-Dos</CardTitle>
        </CardHeader>
        <CardContent>
          {myTodos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Alles erledigt — gut so. ✨
            </p>
          ) : (
            <ul className="space-y-2">
              {myTodos.slice(0, 8).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-md border border-border/50 bg-card px-3 py-2 text-sm"
                >
                  <Link
                    href={`/orders/${t.order_id}`}
                    className="hover:underline"
                  >
                    {t.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(t.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
