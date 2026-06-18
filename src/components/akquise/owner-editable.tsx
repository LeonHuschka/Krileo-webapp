"use client";

import { useState, useTransition } from "react";
import { User, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { updateLeadFields } from "@/app/(app)/akquise/actions";
import { cn } from "@/lib/utils";

/**
 * Inline-editable owner name. Shows the owner (or "Inhaber unbekannt") and
 * lets the user type/correct it on the spot — e.g. when the contact gives
 * their name on the call. Saves via updateLeadFields.
 */
export function OwnerEditable({
  leadId,
  ownerName,
  className,
}: {
  leadId: string;
  ownerName: string | null;
  className?: string;
}) {
  const [current, setCurrent] = useState<string | null>(ownerName);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(ownerName ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const v = value.trim();
    startTransition(async () => {
      try {
        await updateLeadFields({ leadId, owner_name: v || null });
        setCurrent(v || null);
        setEditing(false);
        toast.success("Inhaber gespeichert");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      }
    });
  }

  if (editing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Name des Inhabers…"
          className="h-7 w-44 rounded-md border border-border bg-background px-2 text-sm"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md p-1 text-emerald-400 hover:bg-emerald-500/10"
          title="Speichern"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          title="Abbrechen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(current ?? "");
        setEditing(true);
      }}
      className={cn(
        "group/owner inline-flex items-center gap-1.5 text-left",
        className,
      )}
      title="Inhaber bearbeiten"
    >
      {current ? (
        <span className="inline-flex items-center gap-1.5 text-lg font-bold leading-tight text-primary">
          <User className="h-4 w-4 shrink-0" />
          <span className="break-words">{current}</span>
        </span>
      ) : (
        <span className="text-base font-semibold leading-tight text-muted-foreground/60">
          Inhaber unbekannt
        </span>
      )}
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover/owner:opacity-100" />
    </button>
  );
}
