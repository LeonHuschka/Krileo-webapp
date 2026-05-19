import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  TrendingUp,
  CalendarClock,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateExpenseDialog } from "@/components/expenses/create-expense-dialog";
import { ExpensesTable } from "@/components/expenses/expenses-table";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  monthlyCents,
} from "@/lib/constants";
import type { ExpenseRow } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const fmtEuro = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export default async function BuchhaltungPage() {
  const supabase = await createClient();
  const [{ data: expenses }, { data: members }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .order("status", { ascending: true })
      .order("amount_cents", { ascending: false }),
    supabase.from("user_profiles").select("*").order("full_name"),
  ]);

  const all = (expenses ?? []) as ExpenseRow[];
  const active = all.filter((e) => e.status === "active");

  const monthlyTotal = active.reduce(
    (s, e) => s + monthlyCents(e.amount_cents, e.billing_cycle),
    0,
  );
  const yearlyProjection = monthlyTotal * 12;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDays = new Date(today);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const upcoming = active.filter((e) => {
    if (!e.next_billing_date) return false;
    const d = new Date(e.next_billing_date);
    return d >= today && d <= thirtyDays;
  }).length;

  const categoryTotals = new Map<string, number>();
  for (const e of active) {
    const key = e.category ?? "Ohne Kategorie";
    categoryTotals.set(
      key,
      (categoryTotals.get(key) ?? 0) +
        monthlyCents(e.amount_cents, e.billing_cycle),
    );
  }
  const categoriesSorted = Array.from(categoryTotals.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  const predefined = new Set<string>(EXPENSE_CATEGORIES);
  const extraCategories = Array.from(
    new Set(
      all
        .map((e) => e.category)
        .filter((c): c is string => !!c && !predefined.has(c)),
    ),
  ).sort();

  const predefinedMethods = new Set<string>(PAYMENT_METHODS);
  const extraPaymentMethods = Array.from(
    new Set(
      all
        .map((e) => e.payment_method)
        .filter((m): m is string => !!m && !predefinedMethods.has(m)),
    ),
  ).sort();

  const kpis: {
    label: string;
    value: string;
    sub?: string;
    icon: typeof Receipt;
    accent: string;
    iconBg: string;
  }[] = [
    {
      label: "Monatlich",
      value: fmtEuro(monthlyTotal),
      sub: `${active.length} aktive Posten`,
      icon: Receipt,
      accent: "from-sky-500/15 to-transparent",
      iconBg: "bg-sky-500/15 text-sky-300",
    },
    {
      label: "Jahresprojektion",
      value: fmtEuro(yearlyProjection),
      sub: "monatlich × 12",
      icon: TrendingUp,
      accent: "from-violet-500/15 to-transparent",
      iconBg: "bg-violet-500/15 text-violet-300",
    },
    {
      label: "Fällig in 30 Tagen",
      value: String(upcoming),
      sub: upcoming === 1 ? "Posten" : "Posten",
      icon: CalendarClock,
      accent: "from-amber-500/15 to-transparent",
      iconBg: "bg-amber-500/15 text-amber-300",
    },
    {
      label: "Kategorien",
      value: String(categoryTotals.size),
      sub: "aktiv",
      icon: Layers,
      accent: "from-emerald-500/15 to-transparent",
      iconBg: "bg-emerald-500/15 text-emerald-300",
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Buchhaltung
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Laufende Kosten der Agentur
          </p>
        </div>
        <CreateExpenseDialog
          members={members ?? []}
          extraCategories={extraCategories}
          extraPaymentMethods={extraPaymentMethods}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card
              key={k.label}
              className={cn(
                "relative overflow-hidden border-border/60 bg-gradient-to-br",
                k.accent,
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {k.label}
                  </span>
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg",
                      k.iconBg,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                  {k.value}
                </div>
                {k.sub && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {k.sub}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {categoriesSorted.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Verteilung nach Kategorie (monatlich)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categoriesSorted.map(([cat, cents]) => {
              const pct =
                monthlyTotal > 0 ? Math.round((cents / monthlyTotal) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-border/60 bg-card text-xs font-medium text-muted-foreground"
                      >
                        {cat}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {pct}%
                      </span>
                    </div>
                    <span className="font-medium">{fmtEuro(cents)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-primary"
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <ExpensesTable
        expenses={all}
        members={members ?? []}
        extraCategories={extraCategories}
        extraPaymentMethods={extraPaymentMethods}
      />
    </div>
  );
}
