"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
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
import { GrowthCard } from "@/components/growth/growth-card";
import { EditGrowthTaskDialog } from "@/components/growth/edit-growth-task-dialog";
import { GROWTH_STATUSES, GROWTH_STATUS_COLUMN } from "@/lib/constants";
import { updateGrowthTaskPosition } from "@/app/(app)/growth/actions";
import { cn } from "@/lib/utils";
import type {
  GrowthStatus,
  GrowthTaskRow,
  UserProfileRow,
} from "@/lib/types/database";

function SortableCard({
  task,
  assignee,
  onClick,
}: {
  task: GrowthTaskRow;
  assignee?: UserProfileRow | null;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GrowthCard
        task={task}
        assignee={assignee}
        onClick={onClick}
        isDragging={isDragging}
      />
    </div>
  );
}

function DroppableColumn({
  status,
  label,
  items,
  members,
  isOver,
  onCardClick,
}: {
  status: GrowthStatus;
  label: string;
  items: GrowthTaskRow[];
  members: UserProfileRow[];
  isOver: boolean;
  onCardClick: (task: GrowthTaskRow) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  );
  const c = GROWTH_STATUS_COLUMN[status];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <div
          className={cn("h-1.5 flex-1 rounded-full bg-gradient-to-r", c.bar)}
        />
        <h3
          className={cn(
            "shrink-0 text-xs font-semibold uppercase tracking-wider",
            c.accent,
          )}
        >
          {label}
        </h3>
        <Badge
          variant="outline"
          className={cn(
            "h-5 min-w-[22px] shrink-0 justify-center border-border/60 bg-card px-1.5 text-[10px] font-semibold",
            c.accent,
          )}
        >
          {items.length}
        </Badge>
      </div>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-[220px] flex-1 flex-col gap-2.5 rounded-2xl border border-border/40 p-2 transition-all",
            c.bg,
            isOver && "border-primary/60 bg-primary/[0.06]",
          )}
        >
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-xs text-muted-foreground/50">Nichts hier</p>
            </div>
          ) : (
            items.map((task) => (
              <SortableCard
                key={task.id}
                task={task}
                assignee={
                  task.assigned_to ? memberMap[task.assigned_to] : null
                }
                onClick={() => onCardClick(task)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function GrowthKanban({
  tasks,
  members,
}: {
  tasks: GrowthTaskRow[];
  members: UserProfileRow[];
}) {
  const [items, setItems] = useState<GrowthTaskRow[]>(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<GrowthStatus | null>(null);
  const [mobileCol, setMobileCol] = useState<GrowthStatus>("todo");
  const [editing, setEditing] = useState<GrowthTaskRow | null>(null);

  // Sync local state with server data when not actively dragging
  useEffect(() => {
    if (activeId) return;
    setItems(tasks);
  }, [tasks, activeId]);

  // Refresh the currently-edited task when fresh server data arrives
  useEffect(() => {
    if (!editing) return;
    const fresh = tasks.find((t) => t.id === editing.id);
    if (fresh && fresh.updated_at !== editing.updated_at) {
      setEditing(fresh);
    }
  }, [tasks, editing]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  );

  const grouped = useMemo(
    () =>
      GROWTH_STATUSES.map((s) => ({
        status: s.value,
        label: s.label,
        items: items
          .filter((t) => t.status === s.value)
          .sort((a, b) => a.position - b.position),
      })),
    [items],
  );

  const activeTask = useMemo(
    () => items.find((t) => t.id === activeId) ?? null,
    [items, activeId],
  );

  const findColumn = useCallback(
    (id: string): GrowthStatus | null => {
      if (GROWTH_STATUSES.some((s) => s.value === id))
        return id as GrowthStatus;
      const item = items.find((t) => t.id === id);
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
          prev.map((it) =>
            it.id === active.id ? { ...it, status: overCol } : it,
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
        .filter((t) => t.status === targetCol)
        .sort((a, b) => a.position - b.position);
      const oldIndex = columnItems.findIndex((t) => t.id === active.id);
      const overIndex = columnItems.findIndex((t) => t.id === over.id);
      let reordered = columnItems;
      if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
        reordered = arrayMove(columnItems, oldIndex, overIndex);
      }
      void reordered;

      const original = tasks.find((t) => t.id === active.id);
      const statusChanged = original?.status !== targetCol;
      const newPosition = Date.now();

      setItems((prev) =>
        prev.map((t) =>
          t.id === active.id
            ? { ...t, status: targetCol, position: newPosition }
            : t,
        ),
      );

      void (async () => {
        try {
          await updateGrowthTaskPosition(
            active.id as string,
            newPosition,
            statusChanged ? targetCol : undefined,
          );
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Fehler beim Verschieben",
          );
          setItems(tasks);
        }
      })();
    },
    [items, tasks, findColumn],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
    setItems(tasks);
  }, [tasks]);

  const mobileColData = grouped.find((g) => g.status === mobileCol);

  return (
    <>
      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        <Select
          value={mobileCol}
          onValueChange={(v) => setMobileCol(v as GrowthStatus)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {grouped.map((col) => (
              <SelectItem key={col.status} value={col.status}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-6 rounded-full bg-gradient-to-r",
                      GROWTH_STATUS_COLUMN[col.status].bar,
                    )}
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
              <p className="text-xs text-muted-foreground/60">Nichts hier</p>
            </div>
          ) : (
            mobileColData?.items.map((task) => (
              <GrowthCard
                key={task.id}
                task={task}
                assignee={
                  task.assigned_to ? memberMap[task.assigned_to] : null
                }
                onClick={() => setEditing(task)}
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
          <div className="flex gap-3 pb-4">
            {grouped.map((col) => (
              <DroppableColumn
                key={col.status}
                status={col.status}
                label={col.label}
                items={col.items}
                members={members}
                isOver={overColumnId === col.status}
                onCardClick={setEditing}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="rotate-2 scale-105">
                <GrowthCard
                  task={activeTask}
                  assignee={
                    activeTask.assigned_to
                      ? memberMap[activeTask.assigned_to]
                      : null
                  }
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <EditGrowthTaskDialog
        task={editing}
        members={members}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </>
  );
}
