"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BILLING_CYCLES,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
} from "@/lib/constants";
import {
  deleteExpense,
  updateExpense,
} from "@/app/(app)/buchhaltung/actions";
import { CategoryCombobox } from "@/components/shared/category-combobox";
import type {
  BillingCycle,
  ExpenseRow,
  ExpenseStatus,
  UserProfileRow,
} from "@/lib/types/database";

const NONE = "__none__";

export function EditExpenseDialog({
  expense,
  members,
  extraCategories = [],
  extraPaymentMethods = [],
  open,
  onOpenChange,
}: {
  expense: ExpenseRow | null;
  members: UserProfileRow[];
  extraCategories?: string[];
  extraPaymentMethods?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    name: "",
    vendor: "",
    category: null as string | null,
    amount_cents: 0,
    billing_cycle: "monthly" as BillingCycle,
    status: "active" as ExpenseStatus,
    next_billing_date: null as string | null,
    started_at: null as string | null,
    url: "",
    notes: "",
    paid_by: null as string | null,
    payment_method: null as string | null,
  });

  useEffect(() => {
    if (!expense) return;
    setDraft({
      name: expense.name,
      vendor: expense.vendor ?? "",
      category: expense.category,
      amount_cents: expense.amount_cents,
      billing_cycle: expense.billing_cycle,
      status: expense.status,
      next_billing_date: expense.next_billing_date,
      started_at: expense.started_at,
      url: expense.url ?? "",
      notes: expense.notes ?? "",
      paid_by: expense.paid_by,
      payment_method: expense.payment_method,
    });
  }, [expense]);

  if (!expense) return null;

  function save() {
    if (!expense) return;
    startTransition(async () => {
      try {
        await updateExpense(expense.id, {
          name: draft.name,
          vendor: draft.vendor || null,
          category: draft.category,
          amount_cents: draft.amount_cents,
          billing_cycle: draft.billing_cycle,
          status: draft.status,
          next_billing_date: draft.next_billing_date || null,
          started_at: draft.started_at || null,
          url: draft.url || null,
          notes: draft.notes || null,
          paid_by: draft.paid_by,
          payment_method: draft.payment_method,
        });
        toast.success("Gespeichert");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function remove() {
    if (!expense) return;
    if (!confirm("Kostenpunkt wirklich löschen?")) return;
    startTransition(async () => {
      try {
        await deleteExpense(expense.id);
        toast.success("Gelöscht");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kostenpunkt bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Anbieter</Label>
              <Input
                value={draft.vendor}
                onChange={(e) =>
                  setDraft({ ...draft, vendor: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Betrag (€)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                defaultValue={(draft.amount_cents / 100).toFixed(2)}
                onBlur={(e) => {
                  const n = e.target.valueAsNumber;
                  setDraft({
                    ...draft,
                    amount_cents: Number.isFinite(n) ? Math.round(n * 100) : 0,
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Zyklus</Label>
              <Select
                value={draft.billing_cycle}
                onValueChange={(v) =>
                  setDraft({ ...draft, billing_cycle: v as BillingCycle })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(v) =>
                  setDraft({ ...draft, status: v as ExpenseStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <CategoryCombobox
                value={draft.category}
                onChange={(c) => setDraft({ ...draft, category: c })}
                predefined={EXPENSE_CATEGORIES}
                extra={extraCategories}
              />
            </div>
            <div className="space-y-2">
              <Label>Link</Label>
              <Input
                type="url"
                placeholder="https://…"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kostenträger</Label>
              <Select
                value={draft.paid_by ?? NONE}
                onValueChange={(v) =>
                  setDraft({
                    ...draft,
                    paid_by: v === NONE ? null : v,
                  })
                }
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
              <Label>Zahlungsart</Label>
              <CategoryCombobox
                value={draft.payment_method}
                onChange={(m) => setDraft({ ...draft, payment_method: m })}
                predefined={PAYMENT_METHODS}
                extra={extraPaymentMethods}
                placeholder="— Zahlungsart —"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Aktiv seit</Label>
              <Input
                type="date"
                value={draft.started_at ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    started_at: e.target.value || null,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nächste Abrechnung</Label>
              <Input
                type="date"
                value={draft.next_billing_date ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    next_billing_date: e.target.value || null,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notizen</Label>
            <Textarea
              rows={4}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={remove}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Löschen
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
