"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarSync, Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveRecurringItems } from "@/app/(app)/orders/billing-actions";
import {
  addMonths,
  periodLabel,
  periodOf,
  type Period,
  type RecurringItem,
} from "@/lib/orders/billing";
import { cn } from "@/lib/utils";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** Recurring to-dos of a service contract. The list is the same every month;
 *  ticks are stored per month, so a new month starts with everything open. */
export function MonthlyTasksPanel({
  orderId,
  initialItems,
}: {
  orderId: string;
  initialItems: RecurringItem[];
}) {
  const [items, setItems] = useState<RecurringItem[]>(initialItems);
  const [period, setPeriod] = useState<Period>(periodOf());
  const [newText, setNewText] = useState("");
  const current = periodOf();

  function save(next: RecurringItem[]) {
    const prev = items;
    setItems(next);
    saveRecurringItems(orderId, next).catch((err) => {
      setItems(prev);
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    });
  }

  function add() {
    const title = newText.trim();
    if (!title) return;
    save([...items, { id: newId(), title, done: {} }]);
    setNewText("");
  }

  const done = items.filter((i) => i.done[period]).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarSync className="h-4 w-4 text-primary" />
          Monatliche Aufgaben
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPeriod(addMonths(period, -1))}
            title="Vormonat"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span
            className={cn(
              "min-w-[7.5rem] text-center text-xs font-medium",
              period === current ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {periodLabel(period)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPeriod(addMonths(period, 1))}
            disabled={period >= current}
            title="Nächster Monat"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Wiederkehrende To-dos des Servicevertrags. Jeden Monat startet die Liste
          wieder offen{items.length > 0 ? ` · ${done}/${items.length} erledigt` : ""}.
        </p>

        {items.length > 0 && (
          <div className="space-y-1.5">
            {items.map((it) => {
              const checked = !!it.done[period];
              return (
                <div
                  key={it.id}
                  className="group flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-2"
                >
                  <button
                    type="button"
                    onClick={() =>
                      save(
                        items.map((i) =>
                          i.id === it.id
                            ? { ...i, done: { ...i.done, [period]: !checked } }
                            : i,
                        ),
                      )
                    }
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      checked
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-border hover:border-primary/60",
                    )}
                    title={checked ? "Wieder öffnen" : "Erledigt"}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      checked && "text-muted-foreground line-through",
                    )}
                  >
                    {it.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => save(items.filter((i) => i.id !== it.id))}
                    className="text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    title="Aufgabe entfernen (alle Monate)"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="z. B. Monatsreport senden, Updates einspielen…"
            className="h-9 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            disabled={!newText.trim()}
            className="h-9 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
