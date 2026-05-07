"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTodo, deleteTodo, updateTodo } from "@/app/(app)/orders/actions";
import type { OrderTodoRow, UserProfileRow } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const NONE = "__none__";

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function OrderTodoList({
  orderId,
  todos,
  members,
}: {
  orderId: string;
  todos: OrderTodoRow[];
  members: UserProfileRow[];
}) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const title = newTitle.trim();
    if (!title) return;
    startTransition(async () => {
      try {
        await createTodo({ order_id: orderId, title });
        setNewTitle("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function toggle(t: OrderTodoRow) {
    startTransition(async () => {
      try {
        await updateTodo(t.id, { done: !t.done });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function assign(t: OrderTodoRow, userId: string | null) {
    startTransition(async () => {
      try {
        await updateTodo(t.id, { assigned_to: userId });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function setDue(t: OrderTodoRow, due: string | null) {
    startTransition(async () => {
      try {
        await updateTodo(t.id, { due_date: due });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteTodo(id);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Neues To-Do…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button onClick={add} disabled={pending || !newTitle.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {todos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Noch keine To-Dos. Leg eines an, damit du nichts vergisst.
        </div>
      ) : (
        <ul className="space-y-2">
          {todos.map((t) => {
            const assignee = t.assigned_to ? memberMap[t.assigned_to] : null;
            return (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card p-3"
              >
                <Checkbox
                  checked={t.done}
                  onCheckedChange={() => toggle(t)}
                  className="h-4 w-4"
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 text-sm",
                    t.done && "text-muted-foreground line-through",
                  )}
                >
                  {t.title}
                </span>

                <Input
                  type="date"
                  value={t.due_date ?? ""}
                  onChange={(e) => setDue(t, e.target.value || null)}
                  className="h-8 w-[140px] text-xs"
                />

                <Select
                  value={t.assigned_to ?? NONE}
                  onValueChange={(v) => assign(t, v === NONE ? null : v)}
                >
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue
                      placeholder={
                        assignee
                          ? assignee.full_name || initials(assignee.full_name)
                          : "— niemand —"
                      }
                    />
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

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(t.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
