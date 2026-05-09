"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, FileDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ORDER_STATUS_COLORS,
  ORDER_TYPES,
} from "@/lib/constants";
import { deleteOrder, updateOrder } from "@/app/(app)/orders/actions";
import type {
  ContactRow,
  OrderRow,
  OrderStatus,
  UserProfileRow,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export function OrderDetail({
  order,
  members,
  contacts,
}: {
  order: OrderRow;
  members: UserProfileRow[];
  contacts: ContactRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    title: order.title,
    client_name: order.client_name ?? "",
    description: order.description ?? "",
    value_cents: order.value_cents,
    due_date: order.due_date,
  });

  function patch(values: Record<string, unknown>) {
    startTransition(async () => {
      try {
        await updateOrder(order.id, values);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function saveTextFields() {
    patch({
      title: draft.title,
      client_name: draft.client_name || null,
      description: draft.description || null,
      due_date: draft.due_date || null,
      value_cents: draft.value_cents,
    });
  }

  function remove() {
    if (!confirm("Auftrag wirklich löschen? Alle To-Dos werden mitgelöscht."))
      return;
    startTransition(async () => {
      try {
        await deleteOrder(order.id);
        toast.success("Auftrag gelöscht");
        router.push("/orders");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex-1 space-y-2">
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onBlur={saveTextFields}
            className="border-none bg-transparent px-0 text-xl font-semibold focus-visible:ring-0 md:text-2xl"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("border", ORDER_STATUS_COLORS[order.status])}
            >
              {ORDER_STATUSES.find((s) => s.value === order.status)?.label}
            </Badge>
            <Badge variant="secondary">
              {ORDER_TYPES.find((t) => t.value === order.order_type)?.label}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {order.priority}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5"
            title="Rechnung als PDF herunterladen"
          >
            <a href={`/api/orders/${order.id}/invoice`} download>
              <FileDown className="h-3.5 w-3.5" />
              Rechnung
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            className="text-muted-foreground hover:text-destructive"
            disabled={pending}
            title="Auftrag löschen"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={order.status}
              onValueChange={(v) => patch({ status: v as OrderStatus })}
            >
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
          </div>

          <div className="space-y-2">
            <Label>Priorität</Label>
            <Select
              value={order.priority}
              onValueChange={(v) => patch({ priority: v })}
            >
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
          </div>

          <div className="space-y-2">
            <Label>Typ</Label>
            <Select
              value={order.order_type}
              onValueChange={(v) => patch({ order_type: v })}
            >
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
          </div>

          <div className="space-y-2">
            <Label>Verantwortlich</Label>
            <Select
              value={order.assigned_to ?? NONE}
              onValueChange={(v) =>
                patch({ assigned_to: v === NONE ? null : v })
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
            <Label>Kunden-Name</Label>
            <Input
              value={draft.client_name}
              onChange={(e) =>
                setDraft({ ...draft, client_name: e.target.value })
              }
              onBlur={saveTextFields}
              placeholder="Mustermann GmbH"
            />
          </div>

          <div className="space-y-2">
            <Label>Kontakt</Label>
            <Select
              value={order.contact_id ?? NONE}
              onValueChange={(v) =>
                patch({ contact_id: v === NONE ? null : v })
              }
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
          </div>

          <div className="space-y-2">
            <Label>Wert (€)</Label>
            <Input
              type="number"
              min={0}
              defaultValue={
                draft.value_cents != null ? draft.value_cents / 100 : ""
              }
              onBlur={(e) => {
                const n = e.target.valueAsNumber;
                const cents = Number.isFinite(n) ? Math.round(n * 100) : null;
                if (cents !== order.value_cents) patch({ value_cents: cents });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Fällig am</Label>
            <Input
              type="date"
              value={draft.due_date ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, due_date: e.target.value || null })
              }
              onBlur={saveTextFields}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Beschreibung</Label>
          <Textarea
            rows={5}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            onBlur={saveTextFields}
            placeholder="Was soll gebaut werden? Welche Anforderungen?"
          />
        </div>
      </CardContent>
    </Card>
  );
}
