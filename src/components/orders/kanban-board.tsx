"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { OrderCard } from "@/components/orders/order-card";
import { ORDER_STATUSES } from "@/lib/constants";
import { updateOrderPosition } from "@/app/(app)/orders/actions";
import type {
  OrderRow,
  OrderStatus,
  UserProfileRow,
} from "@/lib/types/database";

interface KanbanProps {
  orders: OrderRow[];
  members: UserProfileRow[];
}

const COLUMN_DOT: Record<OrderStatus, string> = {
  lead: "bg-zinc-400",
  angebot: "bg-blue-400",
  aktiv: "bg-violet-400",
  review: "bg-amber-400",
  geliefert: "bg-emerald-400",
  archiv: "bg-zinc-600",
};

function SortableCard({
  order,
  assignee,
}: {
  order: OrderRow;
  assignee?: UserProfileRow | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: order.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <OrderCard order={order} assignee={assignee} asLink={!isDragging} />
    </div>
  );
}

function DroppableColumn({
  status,
  label,
  items,
  members,
  isOver,
}: {
  status: OrderStatus;
  label: string;
  items: OrderRow[];
  members: UserProfileRow[];
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  );

  return (
    <div className="flex w-72 min-w-[288px] shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2.5 px-1">
        <div className={`h-2.5 w-2.5 rounded-full ${COLUMN_DOT[status]}`} />
        <h3 className="text-sm font-medium">{label}</h3>
        <Badge
          variant="secondary"
          className="ml-auto h-5 min-w-[20px] justify-center px-1.5 text-[10px]"
        >
          {items.length}
        </Badge>
      </div>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-[200px] flex-1 flex-col gap-2.5 rounded-xl border p-2.5 transition-colors ${
            isOver
              ? "border-primary/50 bg-primary/5"
              : "border-border/30 bg-muted/30"
          }`}
        >
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-xs text-muted-foreground/60">Keine Aufträge</p>
            </div>
          ) : (
            items.map((order) => (
              <SortableCard
                key={order.id}
                order={order}
                assignee={
                  order.assigned_to ? memberMap[order.assigned_to] : null
                }
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function OrdersKanban({ orders, members }: KanbanProps) {
  const [items, setItems] = useState<OrderRow[]>(orders);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<OrderStatus | null>(null);
  const [mobileCol, setMobileCol] = useState<OrderStatus>("lead");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const grouped = useMemo(
    () =>
      ORDER_STATUSES.map((s) => ({
        status: s.value,
        label: s.label,
        items: items
          .filter((o) => o.status === s.value)
          .sort((a, b) => a.position - b.position),
      })),
    [items],
  );

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  );

  const activeOrder = useMemo(
    () => items.find((o) => o.id === activeId) ?? null,
    [items, activeId],
  );

  const findColumn = useCallback(
    (id: string): OrderStatus | null => {
      if (ORDER_STATUSES.some((c) => c.value === id))
        return id as OrderStatus;
      const item = items.find((r) => r.id === id);
      return item?.status ?? null;
    },
    [items],
  );

  const handleDragStart = (event: DragStartEvent) =>
    setActiveId(event.active.id as string);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return setOverColumnId(null);
      const activeCol = findColumn(active.id as string);
      const overCol = findColumn(over.id as string);
      if (!activeCol || !overCol) return setOverColumnId(null);
      setOverColumnId(overCol);
      if (activeCol !== overCol) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === active.id ? { ...item, status: overCol } : item,
          ),
        );
      }
    },
    [findColumn],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverColumnId(null);
      if (!over) return;

      const targetCol = findColumn(over.id as string);
      if (!targetCol) return;

      const columnItems = items
        .filter((r) => r.status === targetCol)
        .sort((a, b) => a.position - b.position);
      const oldIndex = columnItems.findIndex((r) => r.id === active.id);
      const overIndex = columnItems.findIndex((r) => r.id === over.id);

      let reordered = columnItems;
      if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
        reordered = arrayMove(columnItems, oldIndex, overIndex);
      }

      const original = orders.find((r) => r.id === active.id);
      const statusChanged = original?.status !== targetCol;

      const newPosition = Date.now();
      setItems((prev) =>
        prev.map((r) =>
          r.id === active.id
            ? { ...r, status: targetCol, position: newPosition }
            : r,
        ),
      );

      void (async () => {
        try {
          await updateOrderPosition(
            active.id as string,
            newPosition,
            statusChanged ? targetCol : undefined,
          );
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Fehler beim Verschieben",
          );
          setItems(orders);
        }
      })();
      void reordered; // suppress unused warning
    },
    [items, orders, findColumn],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
    setItems(orders);
  }, [orders]);

  const mobileColData = grouped.find((g) => g.status === mobileCol);

  return (
    <>
      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        <Select
          value={mobileCol}
          onValueChange={(v) => setMobileCol(v as OrderStatus)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {grouped.map((col) => (
              <SelectItem key={col.status} value={col.status}>
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${COLUMN_DOT[col.status]}`}
                  />
                  {col.label}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({col.items.length})
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-2">
          {mobileColData && mobileColData.items.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 p-6">
              <p className="text-xs text-muted-foreground/60">
                Keine Aufträge in dieser Stage
              </p>
            </div>
          ) : (
            mobileColData?.items.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                assignee={
                  order.assigned_to ? memberMap[order.assigned_to] : null
                }
              />
            ))
          )}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-4">
            {grouped.map((column) => (
              <DroppableColumn
                key={column.status}
                status={column.status}
                label={column.label}
                items={column.items}
                members={members}
                isOver={overColumnId === column.status}
              />
            ))}
          </div>
          <DragOverlay>
            {activeOrder ? (
              <div className="rotate-2 scale-105">
                <OrderCard
                  order={activeOrder}
                  assignee={
                    activeOrder.assigned_to
                      ? memberMap[activeOrder.assigned_to]
                      : null
                  }
                  asLink={false}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </>
  );
}
