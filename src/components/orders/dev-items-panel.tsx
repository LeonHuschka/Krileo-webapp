"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X, Check, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateOrder } from "@/app/(app)/orders/actions";
import type { DevItem } from "@/lib/types/database";
import { cn } from "@/lib/utils";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.floor(Math.random() * 1e9).toString(36);
}

const PRIO: Record<DevItem["priority"], { label: string; cls: string; bar: string }> = {
  high: { label: "Hoch", cls: "text-rose-300 border-rose-500/40 bg-rose-500/10", bar: "bg-rose-500/70" },
  medium: { label: "Mittel", cls: "text-amber-300 border-amber-500/40 bg-amber-500/10", bar: "bg-amber-500/70" },
  low: { label: "Niedrig", cls: "text-zinc-300 border-zinc-500/40 bg-zinc-500/10", bar: "bg-zinc-500/60" },
};
const NEXT_PRIO: Record<DevItem["priority"], DevItem["priority"]> = {
  high: "medium",
  medium: "low",
  low: "high",
};

function SortableRow({
  item,
  onText,
  onToggle,
  onPriority,
  onRemove,
}: {
  item: DevItem;
  onText: (id: string, text: string) => void;
  onToggle: (id: string) => void;
  onPriority: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const prio = PRIO[item.priority];
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex items-center gap-2 overflow-hidden rounded-lg border border-border/50 bg-muted/20 py-2 pl-2.5 pr-2"
    >
      <span className={cn("absolute inset-y-1 left-0 w-1 rounded-r-full", prio.bar)} />
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        title="Zum Sortieren ziehen"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          item.done
            ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
            : "border-border bg-background text-transparent hover:border-primary/50",
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <Input
        defaultValue={item.text}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== item.text) onText(item.id, v);
        }}
        className={cn(
          "h-8 flex-1 border-none bg-transparent px-1 text-sm focus-visible:ring-0",
          item.done && "text-muted-foreground line-through",
        )}
      />
      <button
        type="button"
        onClick={() => onPriority(item.id)}
        className={cn(
          "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          prio.cls,
        )}
        title="Priorität ändern"
      >
        {prio.label}
      </button>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 text-muted-foreground/40 hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function DevItemsPanel({
  orderId,
  initialItems,
}: {
  orderId: string;
  initialItems: DevItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<DevItem[]>(initialItems);
  const [newText, setNewText] = useState("");
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function save(next: DevItem[]) {
    setItems(next);
    startTransition(async () => {
      try {
        await updateOrder(orderId, { dev_items: next });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function addItem() {
    const text = newText.trim();
    if (!text) return;
    setNewText("");
    save([...items, { id: newId(), text, priority: "medium", done: false }]);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    save(arrayMove(items, oldIndex, newIndex));
  }

  const done = items.filter((i) => i.done).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" />
          Technische Anforderungen
        </CardTitle>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {done}/{items.length}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Anforderungen ins Technische übersetzt. Nach Wichtigkeit ziehen
          (oben = wichtiger), Priorität per Klick, abhaken wenn erledigt.
        </p>

        {items.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {items.map((it) => (
                  <SortableRow
                    key={it.id}
                    item={it}
                    onText={(id, text) =>
                      save(items.map((i) => (i.id === id ? { ...i, text } : i)))
                    }
                    onToggle={(id) =>
                      save(
                        items.map((i) =>
                          i.id === id ? { ...i, done: !i.done } : i,
                        ),
                      )
                    }
                    onPriority={(id) =>
                      save(
                        items.map((i) =>
                          i.id === id
                            ? { ...i, priority: NEXT_PRIO[i.priority] }
                            : i,
                        ),
                      )
                    }
                    onRemove={(id) => save(items.filter((i) => i.id !== id))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="Technische Anforderung hinzufügen…"
            className="h-9 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            disabled={!newText.trim()}
            className="h-9 shrink-0 gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
