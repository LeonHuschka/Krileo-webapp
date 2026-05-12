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
import { GROWTH_STATUSES, ORDER_PRIORITIES } from "@/lib/constants";
import {
  deleteGrowthTask,
  updateGrowthTask,
} from "@/app/(app)/growth/actions";
import { TagInput } from "@/components/contacts/tag-input";
import type {
  GrowthStatus,
  GrowthTaskRow,
  OrderPriority,
  UserProfileRow,
} from "@/lib/types/database";

const NONE = "__none__";

export function EditGrowthTaskDialog({
  task,
  members,
  open,
  onOpenChange,
}: {
  task: GrowthTaskRow | null;
  members: UserProfileRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    category: "",
    due_date: null as string | null,
    status: "todo" as GrowthStatus,
    priority: "medium" as OrderPriority,
    assigned_to: null as string | null,
    tags: [] as string[],
  });

  useEffect(() => {
    if (!task) return;
    setDraft({
      title: task.title,
      description: task.description ?? "",
      category: task.category ?? "",
      due_date: task.due_date,
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to,
      tags: task.tags,
    });
  }, [task]);

  if (!task) return null;

  function save() {
    if (!task) return;
    startTransition(async () => {
      try {
        await updateGrowthTask(task.id, {
          title: draft.title,
          description: draft.description || null,
          category: draft.category || null,
          due_date: draft.due_date || null,
          status: draft.status,
          priority: draft.priority,
          assigned_to: draft.assigned_to,
          tags: draft.tags,
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

          <div className="grid grid-cols-3 gap-3">
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
            <div className="space-y-2">
              <Label>Fällig</Label>
              <Input
                type="date"
                value={draft.due_date ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, due_date: e.target.value || null })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Input
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value })
                }
                placeholder="Marketing, Sales, Ops, …"
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
            <Label>Tags</Label>
            <TagInput
              value={draft.tags}
              onChange={(tags) => setDraft({ ...draft, tags })}
            />
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
