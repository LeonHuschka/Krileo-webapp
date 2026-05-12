"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListChecks, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { GROWTH_STATUS_COLUMN, PRIORITY_COLORS } from "@/lib/constants";
import {
  deleteGrowthTask,
  updateGrowthTask,
} from "@/app/(app)/growth/actions";
import type { GrowthTaskRow, UserProfileRow } from "@/lib/types/database";
import { cn } from "@/lib/utils";

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function GrowthCard({
  task,
  assignee,
  onClick,
  isDragging,
}: {
  task: GrowthTaskRow;
  assignee?: UserProfileRow | null;
  onClick?: () => void;
  isDragging?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const col = GROWTH_STATUS_COLUMN[task.status];
  const isDone = task.status === "done" || task.status === "archiv";
  const subtasks = task.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const allSubsDone = subtasks.length > 0 && doneCount === subtasks.length;

  function toggleDone() {
    startTransition(async () => {
      try {
        await updateGrowthTask(task.id, {
          status: isDone ? "todo" : "done",
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Task wirklich löschen?")) return;
    startTransition(async () => {
      try {
        await deleteGrowthTask(task.id);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer space-y-2 overflow-hidden border-border/60 bg-card p-3 pl-3.5 shadow-none transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10",
        isDragging && "opacity-50",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b",
          col.bar,
        )}
      />
      <div className="flex items-start gap-2">
        <div
          onClick={(e) => {
            e.stopPropagation();
            toggleDone();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-0.5"
        >
          <Checkbox
            checked={isDone}
            disabled={pending}
            className="h-4 w-4 cursor-pointer"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "break-words text-sm font-semibold leading-tight",
              isDone && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 border text-[10px] font-semibold uppercase tracking-wide",
            PRIORITY_COLORS[task.priority],
          )}
        >
          {task.priority}
        </Badge>
      </div>

      {task.category && (
        <div className="pl-6">
          <Badge
            variant="outline"
            className="border-border/60 bg-card text-[10px] font-medium text-muted-foreground"
          >
            {task.category}
          </Badge>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pl-6 pt-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {subtasks.length > 0 && (
            <div
              className={cn(
                "flex items-center gap-1 font-medium",
                allSubsDone && "text-emerald-400",
              )}
              title={`${doneCount} von ${subtasks.length} erledigt`}
            >
              <ListChecks className="h-3 w-3" />
              {doneCount}/{subtasks.length}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          {assignee && (
            <Avatar className="h-6 w-6 ring-1 ring-border">
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-[10px] font-semibold text-foreground">
                {initials(assignee.full_name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </Card>
  );
}
