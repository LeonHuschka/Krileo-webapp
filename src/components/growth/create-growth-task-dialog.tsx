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
import { GROWTH_STATUSES, ORDER_PRIORITIES } from "@/lib/constants";
import {
  growthCreateSchema,
  type GrowthCreateData,
} from "@/lib/validations/growth";
import { createGrowthTask } from "@/app/(app)/growth/actions";
import { CategoryCombobox } from "@/components/shared/category-combobox";
import { GROWTH_CATEGORIES } from "@/lib/constants";
import type { UserProfileRow } from "@/lib/types/database";

const NONE = "__none__";

export function CreateGrowthTaskDialog({
  members,
  extraCategories = [],
}: {
  members: UserProfileRow[];
  extraCategories?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<GrowthCreateData>({
    resolver: zodResolver(growthCreateSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      category: null,
      tags: [],
      due_date: null,
      assigned_to: null,
    },
  });

  function onSubmit(values: GrowthCreateData) {
    startTransition(async () => {
      try {
        await createGrowthTask(values);
        toast.success("Task angelegt");
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
          <Plus className="h-4 w-4" /> Neuer Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuer Growth-Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              placeholder="z. B. Cold-Outreach-Kampagne für Bäckereien"
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
                      {GROWTH_STATUSES.map((s) => (
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
              <Label>Kategorie</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <CategoryCombobox
                    value={field.value ?? null}
                    onChange={field.onChange}
                    predefined={GROWTH_CATEGORIES}
                    extra={extraCategories}
                  />
                )}
              />
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Notizen</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Was genau ist zu tun? Erfolgskriterien?"
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
