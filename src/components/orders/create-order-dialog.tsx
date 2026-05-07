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
  ORDER_PRIORITIES,
  ORDER_STATUSES,
  ORDER_TYPES,
} from "@/lib/constants";
import {
  orderCreateSchema,
  type OrderCreateData,
} from "@/lib/validations/order";
import { createOrder } from "@/app/(app)/orders/actions";
import type { ContactRow, UserProfileRow } from "@/lib/types/database";

const NONE = "__none__";

export function CreateOrderDialog({
  contacts,
  members,
  defaultStatus = "lead",
}: {
  contacts: ContactRow[];
  members: UserProfileRow[];
  defaultStatus?: OrderCreateData["status"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<OrderCreateData>({
    resolver: zodResolver(orderCreateSchema),
    defaultValues: {
      title: "",
      client_name: "",
      contact_id: null,
      order_type: "website",
      status: defaultStatus,
      priority: "medium",
      value_cents: null,
      due_date: null,
      assigned_to: null,
      description: "",
    },
  });

  function onSubmit(values: OrderCreateData) {
    startTransition(async () => {
      try {
        await createOrder(values);
        toast.success("Auftrag angelegt");
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
          <Plus className="h-4 w-4" /> Neuer Auftrag
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuer Auftrag</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              placeholder="z. B. Website Mustermann GmbH"
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="client_name">Kunde (Name)</Label>
              <Input
                id="client_name"
                placeholder="Mustermann GmbH"
                {...form.register("client_name")}
              />
            </div>
            <div className="space-y-2">
              <Label>Kontakt</Label>
              <Controller
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— keiner —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— keiner —</SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.company ? ` · ${c.company}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Controller
                control={form.control}
                name="order_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
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
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
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
              <Label htmlFor="value">Wert (€)</Label>
              <Input
                id="value"
                type="number"
                min={0}
                step={1}
                placeholder="3500"
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  form.setValue(
                    "value_cents",
                    Number.isFinite(n) ? Math.round(n * 100) : null,
                  );
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Fällig am</Label>
              <Input id="due_date" type="date" {...form.register("due_date")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Verantwortlich</Label>
            <Controller
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? null : v)}
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
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Was soll gebaut werden?"
              {...form.register("description")}
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
