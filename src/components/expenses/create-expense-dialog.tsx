"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  expenseCreateSchema,
  type ExpenseCreateData,
} from "@/lib/validations/expense";
import { createExpense } from "@/app/(app)/buchhaltung/actions";
import { CategoryCombobox } from "@/components/shared/category-combobox";
import type { UserProfileRow } from "@/lib/types/database";

const NONE = "__none__";

export function CreateExpenseDialog({
  members,
  extraCategories = [],
  extraPaymentMethods = [],
}: {
  members: UserProfileRow[];
  extraCategories?: string[];
  extraPaymentMethods?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<ExpenseCreateData>({
    resolver: zodResolver(expenseCreateSchema),
    defaultValues: {
      name: "",
      vendor: "",
      category: null,
      amount_cents: 0,
      billing_cycle: "monthly",
      status: "active",
      next_billing_date: null,
      started_at: null,
      url: "",
      notes: "",
      paid_by: null,
      payment_method: null,
    },
  });

  function onSubmit(values: ExpenseCreateData) {
    startTransition(async () => {
      try {
        await createExpense(values);
        toast.success("Kostenpunkt angelegt");
        setOpen(false);
        form.reset();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Neuer Kostenpunkt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuer Kostenpunkt</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="z. B. Supabase Pro"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Anbieter</Label>
              <Input
                id="vendor"
                placeholder="z. B. Supabase Inc."
                {...form.register("vendor")}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Betrag (€)</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                placeholder="29.00"
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  form.setValue(
                    "amount_cents",
                    Number.isFinite(n) ? Math.round(n * 100) : 0,
                  );
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Zyklus</Label>
              <Controller
                control={form.control}
                name="billing_cycle"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <CategoryCombobox
                    value={field.value ?? null}
                    onChange={field.onChange}
                    predefined={EXPENSE_CATEGORIES}
                    extra={extraCategories}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Link</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://app.supabase.com"
                {...form.register("url")}
              />
              {form.formState.errors.url && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.url.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kostenträger</Label>
              <Controller
                control={form.control}
                name="paid_by"
                render={({ field }) => (
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) =>
                      field.onChange(v === NONE ? null : v)
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
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Zahlungsart</Label>
              <Controller
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <CategoryCombobox
                    value={field.value ?? null}
                    onChange={field.onChange}
                    predefined={PAYMENT_METHODS}
                    extra={extraPaymentMethods}
                    placeholder="— Zahlungsart —"
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="started_at">Aktiv seit</Label>
              <Input
                id="started_at"
                type="date"
                {...form.register("started_at")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_billing">Nächste Abrechnung</Label>
              <Input
                id="next_billing"
                type="date"
                {...form.register("next_billing_date")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Vertragsnummer, Kündigungsfrist, …"
              {...form.register("notes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Speichern..." : "Anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
