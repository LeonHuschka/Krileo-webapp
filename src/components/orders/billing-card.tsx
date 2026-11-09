"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, Repeat, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  setOrderPaid,
  setPeriodPaid,
  updateBilling,
} from "@/app/(app)/orders/billing-actions";
import {
  PAY_STATE_UI,
  fmtEuro,
  paymentsOf,
  payStateOf,
  periodLabel,
  periodOf,
  periodsSince,
} from "@/lib/orders/billing";
import type { OrderRow } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const dateDE = (iso: string) => new Date(iso).toLocaleDateString("de-DE");

/** Billing settings + paid tracking for an order. Lives in the Auftrag tab. */
export function BillingCard({ order }: { order: OrderRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const monthly = order.billing_cycle === "monthly";
  const [fee, setFee] = useState(
    order.monthly_cents != null ? String(order.monthly_cents / 100) : "",
  );
  const [paidOn, setPaidOn] = useState(today());

  const run = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });

  const { state } = payStateOf(order);
  const payments = new Map(paymentsOf(order).map((p) => [p.period, p.paid_at]));
  const months = periodsSince(order.contract_start, periodOf()).reverse().slice(0, 12);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-primary" />
          Abrechnung
        </CardTitle>
        {state !== "none" && (
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
              PAY_STATE_UI[state].cls,
            )}
          >
            {PAY_STATE_UI[state].label}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cycle switch */}
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-1">
          {(
            [
              ["once", "Einmaliges Projekt"],
              ["monthly", "Laufend · monatlich"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              disabled={pending}
              onClick={() =>
                v !== order.billing_cycle &&
                run(() =>
                  updateBilling(order.id, {
                    billing_cycle: v,
                    contract_start:
                      v === "monthly" && !order.contract_start
                        ? `${periodOf()}-01`
                        : order.contract_start,
                  }),
                )
              }
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                order.billing_cycle === v
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "monthly" && <Repeat className="h-3.5 w-3.5" />}
              {label}
            </button>
          ))}
        </div>

        {!monthly ? (
          /* One-time: single paid flag */
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Zahlung</Label>
            {order.paid_at ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Bezahlt am {dateDE(order.paid_at)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => setOrderPaid(order.id, null))}
                  className="h-7 text-xs text-muted-foreground"
                >
                  Zurücksetzen
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  className="h-9 w-40"
                />
                <Button
                  size="sm"
                  disabled={pending || !paidOn}
                  onClick={() => run(() => setOrderPaid(order.id, paidOn), "Als bezahlt markiert")}
                  className="h-9 gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Als bezahlt markieren
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Monthly: fee, start, per-month payments */
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Monatlich (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  onBlur={() => {
                    const cents = fee.trim() === "" ? null : Math.round(Number(fee) * 100);
                    if (cents !== order.monthly_cents)
                      run(() => updateBilling(order.id, { monthly_cents: cents }));
                  }}
                  placeholder="490"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Vertragsbeginn</Label>
                <Input
                  type="month"
                  value={(order.contract_start ?? "").slice(0, 7)}
                  onChange={(e) =>
                    e.target.value &&
                    run(() =>
                      updateBilling(order.id, { contract_start: `${e.target.value}-01` }),
                    )
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Zahlungen {order.monthly_cents ? `· ${fmtEuro(order.monthly_cents)} / Monat` : ""}
              </Label>
              {months.length === 0 ? (
                <p className="text-xs text-muted-foreground">Vertrag startet in der Zukunft.</p>
              ) : (
                <div className="divide-y divide-border/40 rounded-lg border border-border/60">
                  {months.map((p) => {
                    const paidAt = payments.get(p);
                    const past = p < periodOf();
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(() => setPeriodPaid(order.id, p, paidAt ? null : today()))
                        }
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/30"
                      >
                        <span className="flex items-center gap-2">
                          {paidAt ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Circle
                              className={cn(
                                "h-4 w-4",
                                past ? "text-rose-400" : "text-muted-foreground/50",
                              )}
                            />
                          )}
                          {periodLabel(p)}
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            paidAt
                              ? "text-emerald-300"
                              : past
                                ? "text-rose-300"
                                : "text-muted-foreground",
                          )}
                        >
                          {paidAt ? `bezahlt ${dateDE(paidAt)}` : past ? "überfällig" : "offen"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Klick auf einen Monat markiert ihn als bezahlt (heute) bzw. wieder offen.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
