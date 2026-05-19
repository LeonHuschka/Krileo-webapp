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
import { TOOL_CATEGORIES } from "@/lib/constants";
import {
  toolCreateSchema,
  type ToolCreateData,
} from "@/lib/validations/tool";
import { createTool } from "@/app/(app)/tools/actions";
import { CategoryCombobox } from "@/components/shared/category-combobox";

export function CreateToolDialog({
  extraCategories = [],
}: {
  extraCategories?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<ToolCreateData>({
    resolver: zodResolver(toolCreateSchema),
    defaultValues: {
      name: "",
      category: null,
      url: "",
      login_email: "",
      login_username: "",
      login_password: "",
      notes: "",
    },
  });

  function onSubmit(values: ToolCreateData) {
    startTransition(async () => {
      try {
        await createTool(values);
        toast.success("Tool angelegt");
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
          <Plus className="h-4 w-4" /> Neues Tool
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neues Tool</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="z. B. Supabase"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <CategoryCombobox
                    value={field.value ?? null}
                    onChange={field.onChange}
                    predefined={TOOL_CATEGORIES}
                    extra={extraCategories}
                  />
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Link</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://app.supabase.com"
              {...form.register("url")}
            />
            {form.formState.errors.url && (
              <p className="text-xs text-destructive">
                {form.formState.errors.url.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="login_email">Login-E-Mail</Label>
              <Input
                id="login_email"
                placeholder="login@krileo.com"
                {...form.register("login_email")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login_username">Username</Label>
              <Input
                id="login_username"
                placeholder="optional"
                {...form.register("login_username")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="login_password">Passwort</Label>
            <Input
              id="login_password"
              type="text"
              placeholder="••••"
              autoComplete="off"
              {...form.register("login_password")}
            />
            <p className="text-[11px] text-muted-foreground">
              Wird unverschlüsselt in der Datenbank gespeichert. Nur Team-
              Mitglieder mit Login sehen es.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="2FA-Hinweise, Recovery, …"
              {...form.register("notes")}
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
