"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { updateLeadFields } from "@/app/(app)/akquise/actions";
import { cn } from "@/lib/utils";

type Field = "business_name" | "owner_name" | "phone";

/**
 * Inline-editable lead field (business name, phone, …). Maps data scraped from
 * Google Maps is often stale (renamed business, old phone, wrong owner after a
 * handover) — this lets the user correct it on the spot. Click → edit → Enter.
 */
export function EditableField({
  leadId,
  field,
  value,
  placeholder,
  emptyLabel,
  displayClassName,
  inputClassName,
}: {
  leadId: string;
  field: Field;
  value: string | null;
  placeholder?: string;
  emptyLabel?: string;
  displayClassName?: string;
  inputClassName?: string;
}) {
  const [current, setCurrent] = useState<string | null>(value);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    const v = val.trim();
    if (field === "business_name" && !v) {
      toast.error("Firmenname darf nicht leer sein");
      return;
    }
    startTransition(async () => {
      try {
        await updateLeadFields({ leadId, [field]: v || null });
        setCurrent(v || null);
        setEditing(false);
        toast.success("Gespeichert");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      }
    });
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder={placeholder}
          className={cn(
            "rounded-md border border-border bg-background px-2 py-1",
            inputClassName,
          )}
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
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setVal(current ?? "");
        setEditing(true);
      }}
      className={cn(
        "group/ef inline-flex items-center gap-1.5 text-left",
        displayClassName,
      )}
      title="Bearbeiten"
    >
      <span className={cn(!current && "text-muted-foreground/60")}>
        {current || emptyLabel || placeholder}
      </span>
      <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover/ef:opacity-100" />
    </button>
  );
}
