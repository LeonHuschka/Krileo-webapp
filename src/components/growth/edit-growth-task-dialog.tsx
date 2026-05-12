"use client";

import { useEffect, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { GROWTH_STATUSES, ORDER_PRIORITIES } from "@/lib/constants";
import {
  deleteGrowthTask,
  updateGrowthTask,
} from "@/app/(app)/growth/actions";
import { CategoryCombobox } from "@/components/growth/category-combobox";
import type {
  GrowthStatus,
  GrowthTaskRow,
  OrderPriority,
  Subtask,
  UserProfileRow,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export function EditGrowthTaskDialog({
  task,
  members,
  extraCategories = [],
  open,
  onOpenChange,
}: {
  task: GrowthTaskRow | null;
  members: UserProfileRow[];
  extraCategories?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    category: null as string | null,
    status: "todo" as GrowthStatus,
    priority: "medium" as OrderPriority,
    assigned_to: null as string | null,
    subtasks: [] as Subtask[],
  });
  const [newSubtask, setNewSubtask] = useState("");

  useEffect(() => {
    if (!task) return;
    setDraft({
      title: task.title,
      description: task.description ?? "",
      category: task.category,
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to,
      subtasks: task.subtasks ?? [],
    });
    setNewSubtask("");
  }, [task]);

  function addSubtask() {
    const title = newSubtask.trim();
    if (!title) return;
    const next: Subtask = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      done: false,
    };
    setDraft((d) => ({ ...d, subtasks: [...d.subtasks, next] }));
    setNewSubtask("");
  }

  function toggleSubtask(id: string) {
    setDraft((d) => ({
      ...d,
      subtasks: d.subtasks.map((s) =>
        s.id === id ? { ...s, done: !s.done } : s,
      ),
    }));
  }

  function renameSubtask(id: string, title: string) {
    setDraft((d) => ({
      ...d,
      subtasks: d.subtasks.map((s) => (s.id === id ? { ...s, title } : s)),
    }));
  }

  function removeSubtask(id: string) {
    setDraft((d) => ({
      ...d,
      subtasks: d.subtasks.filter((s) => s.id !== id),
    }));
  }

  function onNewSubtaskKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubtask();
    }
  }

  if (!task) return null;

  function save() {
    if (!task) return;
    const cleanedSubtasks = draft.subtasks
      .map((s) => ({ ...s, title: s.title.trim() }))
      .filter((s) => s.title.length > 0);
    startTransition(async () => {
      try {
        await updateGrowthTask(task.id, {
          title: draft.title,
          description: draft.description || null,
          category: draft.category,
          status: draft.status,
          priority: draft.priority,
          assigned_to: draft.assigned_to,
          subtasks: cleanedSubtasks,
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
    if (!task) return;
    if (!confirm("Task wirklich löschen?")) return;
    startTransition(async () => {
      try {
        await deleteGrowthTask(task.id);
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
          <DialogTitle>Task bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Titel</Label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(v) =>
                  setDraft({ ...draft, status: v as GrowthStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_STATUSES.map((s) => (
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
                value={draft.priority}
                onValueChange={(v) =>
                  setDraft({ ...draft, priority: v as OrderPriority })
                }
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <CategoryCombobox
                value={draft.category}
                onChange={(c) => setDraft({ ...draft, category: c })}
                extra={extraCategories}
              />
            </div>
            <div className="space-y-2">
              <Label>Verantwortlich</Label>
              <Select
                value={draft.assigned_to ?? NONE}
                onValueChange={(v) =>
                  setDraft({
                    ...draft,
                    assigned_to: v === NONE ? null : v,
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
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Unteraufgaben</Label>
              {draft.subtasks.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {draft.subtasks.filter((s) => s.done).length} /{" "}
                  {draft.subtasks.length} erledigt
                </span>
              )}
            </div>
            {draft.subtasks.length > 0 && (
              <ul className="space-y-1">
                {draft.subtasks.map((s) => (
                  <li
                    key={s.id}
                    className="group flex items-center gap-2 rounded-md border border-border/40 bg-card/60 px-2 py-1.5"
                  >
                    <Checkbox
                      checked={s.done}
                      onCheckedChange={() => toggleSubtask(s.id)}
                      className="h-4 w-4"
                    />
                    <Input
                      value={s.title}
                      onChange={(e) => renameSubtask(s.id, e.target.value)}
                      className={cn(
                        "h-7 flex-1 border-none bg-transparent px-1 text-sm shadow-none focus-visible:bg-background focus-visible:ring-1",
                        s.done && "text-muted-foreground line-through",
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSubtask(s.id)}
                      className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={onNewSubtaskKey}
                placeholder="Neue Unteraufgabe…"
                className="h-9 text-sm"
              />
              <Button
                type="button"
                onClick={addSubtask}
                disabled={!newSubtask.trim()}
                size="icon"
                variant="outline"
                className="h-9 w-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notizen</Label>
            <Textarea
              rows={5}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Was genau ist zu tun? Erfolgskriterien?"
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
