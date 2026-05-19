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
import { TOOL_CATEGORIES } from "@/lib/constants";
import { deleteTool, updateTool } from "@/app/(app)/tools/actions";
import { CategoryCombobox } from "@/components/shared/category-combobox";
import type { ToolRow } from "@/lib/types/database";

export function EditToolDialog({
  tool,
  extraCategories = [],
  open,
  onOpenChange,
}: {
  tool: ToolRow | null;
  extraCategories?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    name: "",
    category: null as string | null,
    url: "",
    login_email: "",
    login_username: "",
    login_password: "",
    notes: "",
  });

  useEffect(() => {
    if (!tool) return;
    setDraft({
      name: tool.name,
      category: tool.category,
      url: tool.url ?? "",
      login_email: tool.login_email ?? "",
      login_username: tool.login_username ?? "",
      login_password: tool.login_password ?? "",
      notes: tool.notes ?? "",
    });
  }, [tool]);

  if (!tool) return null;

  function save() {
    if (!tool) return;
    startTransition(async () => {
      try {
        await updateTool(tool.id, {
          name: draft.name,
          category: draft.category,
          url: draft.url || null,
          login_email: draft.login_email || null,
          login_username: draft.login_username || null,
          login_password: draft.login_password || null,
          notes: draft.notes || null,
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
    if (!tool) return;
    if (!confirm("Tool wirklich löschen?")) return;
    startTransition(async () => {
      try {
        await deleteTool(tool.id);
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
          <DialogTitle>Tool bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <CategoryCombobox
                value={draft.category}
                onChange={(c) => setDraft({ ...draft, category: c })}
                predefined={TOOL_CATEGORIES}
                extra={extraCategories}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Link</Label>
            <Input
              type="url"
              placeholder="https://…"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Login-E-Mail</Label>
              <Input
                value={draft.login_email}
                onChange={(e) =>
                  setDraft({ ...draft, login_email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={draft.login_username}
                onChange={(e) =>
                  setDraft({ ...draft, login_username: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Passwort</Label>
            <Input
              type="text"
              autoComplete="off"
              value={draft.login_password}
              onChange={(e) =>
                setDraft({ ...draft, login_password: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Notizen</Label>
            <Textarea
              rows={4}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
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
