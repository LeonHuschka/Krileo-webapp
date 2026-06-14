"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { TrendingUp, Plus, X, Save, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSalesPoints } from "@/app/(app)/akquise/actions";

/** Split "Titel – Beschreibung" into bold title + rest for display. */
function splitPoint(p: string): { title: string; desc: string } {
  const m = p.match(/^(.+?)\s[–-]\s([\s\S]+)$/);
  if (m) return { title: m[1].trim(), desc: m[2].trim() };
  return { title: p.trim(), desc: "" };
}

export function SalesPointsEditor({
  leadId,
  initial,
}: {
  leadId: string;
  initial: string[] | null;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState<string[]>(initial ?? []);
  const [draft, setDraft] = useState("");

  function persist(next: string[]) {
    setPoints(next);
    startTransition(async () => {
      try {
        await saveSalesPoints(leadId, next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function addDraft() {
    const v = draft.trim();
    if (!v) return;
    persist([...points, v]);
    setDraft("");
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
          <TrendingUp className="h-3.5 w-3.5" /> Sales-Argumente
        </span>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="text-muted-foreground hover:text-foreground"
          title={editing ? "Fertig" : "Bearbeiten"}
        >
          {editing ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Pencil className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {points.length === 0 && !editing && (
        <p className="text-[11px] text-muted-foreground">
          Noch keine — Re-Score oder unten hinzufügen.
        </p>
      )}

      {!editing ? (
        <ol className="space-y-1.5">
          {points.map((p, i) => {
            const { title, desc } = splitPoint(p);
            return (
              <li key={i} className="flex gap-1.5 text-sm leading-snug">
                <span className="font-semibold text-amber-300">{i + 1}.</span>
                <span>
                  <span className="font-semibold text-amber-200">{title}</span>
                  {desc && (
                    <span className="text-muted-foreground"> – {desc}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="space-y-1.5">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={p}
                onChange={(e) => {
                  const next = [...points];
                  next[i] = e.target.value;
                  setPoints(next);
                }}
                onBlur={() => persist(points)}
                className="h-8 text-xs"
              />
              <button
                type="button"
                onClick={() => persist(points.filter((_, j) => j !== i))}
                className="shrink-0 text-muted-foreground/50 hover:text-rose-300"
                title="Entfernen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Titel – Beschreibung"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 px-2"
              onClick={addDraft}
              disabled={pending}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Save className="h-3 w-3" /> Änderungen werden automatisch
            gespeichert · Format: „Titel – Beschreibung“
          </p>
        </div>
      )}
    </div>
  );
}
