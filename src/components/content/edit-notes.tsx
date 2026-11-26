"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { saveEditNotes } from "@/app/d/actions";
import type { EditNote } from "@/lib/content/types";
import { cn } from "@/lib/utils";

/** Checklist of changes for the editor (saved optimistically, rolled back on error). */
export function EditNotes({
  token,
  itemId,
  initial,
  lang,
}: {
  token: string;
  itemId: string;
  initial: EditNote[];
  lang: "de" | "en";
}) {
  const [notes, setNotes] = useState<EditNote[]>(initial ?? []);
  const [text, setText] = useState("");
  const [, start] = useTransition();
  const done = notes.filter((n) => n.done).length;

  function save(next: EditNote[]) {
    const prev = notes;
    setNotes(next);
    start(async () => {
      const r = await saveEditNotes({ token, itemId, notes: next });
      if (!r.ok) {
        setNotes(prev);
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{lang === "de" ? "Schnitt-Notizen" : "Edit notes"}</span>
        {notes.length > 0 && (
          <span className="text-xs text-white/50">
            {done}/{notes.length} {lang === "de" ? "erledigt" : "done"}
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {notes.map((n, i) => (
          <li key={i} className="group flex items-start gap-2 text-sm">
            <button
              onClick={() => save(notes.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                n.done ? "border-emerald-500 bg-emerald-500" : "border-white/30",
              )}
            >
              {n.done && <Check className="h-3 w-3 text-white" />}
            </button>
            <span className={cn("flex-1", n.done && "text-white/40 line-through")}>{n.text}</span>
            <button
              onClick={() => save(notes.filter((_, j) => j !== i))}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Entfernen"
            >
              <X className="h-3.5 w-3.5 text-white/50" />
            </button>
          </li>
        ))}
      </ul>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) {
            save([...notes, { text: text.trim(), done: false }]);
            setText("");
          }
        }}
        placeholder={lang === "de" ? "Änderung hinzufügen … (Enter)" : "Add a change… (Enter)"}
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-400/40"
      />
    </div>
  );
}
