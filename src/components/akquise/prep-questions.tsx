"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  MessageCircleQuestion,
  Sparkles,
  Loader2,
  RefreshCw,
  Plus,
  X,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  generatePrepQuestions,
  answerPrepQuestion,
  savePrepQa,
} from "@/app/(app)/akquise/actions";

type QA = { q: string; a: string };

export function PrepQuestions({
  leadId,
  initialQa,
}: {
  leadId: string;
  initialQa: QA[] | null;
}) {
  const [pending, startTransition] = useTransition();
  const [qa, setQa] = useState<QA[]>(initialQa ?? []);
  const [focus, setFocus] = useState("");
  const [answeringIdx, setAnsweringIdx] = useState<number | null>(null);

  // always-present add row
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [answeringNew, setAnsweringNew] = useState(false);

  function persist(next: QA[]) {
    startTransition(async () => {
      try {
        await savePrepQa(leadId, next);
      } catch {
        /* */
      }
    });
  }

  function generate() {
    startTransition(async () => {
      try {
        const next = await generatePrepQuestions({
          leadId,
          focus: focus.trim() || undefined,
        });
        setQa(next);
        setFocus("");
        toast.success("Gesprächsvorbereitung aktualisiert");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function updateItem(i: number, patch: Partial<QA>) {
    setQa((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  function removeItem(i: number) {
    const next = qa.filter((_, j) => j !== i);
    setQa(next);
    persist(next);
  }

  async function answerItem(i: number) {
    const q = qa[i]?.q?.trim();
    if (!q) {
      toast.error("Erst die Frage ausfüllen");
      return;
    }
    setAnsweringIdx(i);
    try {
      const a = await answerPrepQuestion({ leadId, question: q });
      const next = qa.map((x, j) => (j === i ? { ...x, a } : x));
      setQa(next);
      persist(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setAnsweringIdx(null);
    }
  }

  async function answerNew() {
    if (!newQ.trim()) {
      toast.error("Erst deine Frage eintippen");
      return;
    }
    setAnsweringNew(true);
    try {
      const a = await answerPrepQuestion({ leadId, question: newQ.trim() });
      setNewA(a);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setAnsweringNew(false);
    }
  }

  function addNew() {
    if (!newQ.trim()) {
      toast.error("Frage fehlt");
      return;
    }
    const next = [...qa, { q: newQ.trim(), a: newA.trim() }];
    setQa(next);
    setNewQ("");
    setNewA("");
    persist(next);
    toast.success("Frage hinzugefügt");
  }

  return (
    <div className="space-y-3 rounded-lg border border-violet-500/25 bg-violet-500/[0.04] p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-violet-300">
        <MessageCircleQuestion className="h-3.5 w-3.5" /> Gesprächsvorbereitung
      </div>
      <p className="text-[11px] text-muted-foreground">
        Claude generiert die Fragen + Einwände, die der Inhaber fast sicher
        bringt — mit fertigen Antworten. Alles frei editierbar, eigene Fragen
        jederzeit unten ergänzen (Claude hilft bei der Antwort).
      </p>

      {/* AI generate */}
      <div className="flex gap-1.5">
        <Input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder='Optional: Fokus — z.B. "skeptisch beim Preis"'
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              generate();
            }
          }}
        />
        <Button
          size="sm"
          className="h-8 shrink-0 gap-1 border-violet-500/40 bg-violet-600/80 text-[11px] text-white hover:bg-violet-600"
          disabled={pending}
          onClick={generate}
        >
          {pending && answeringIdx === null ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : qa.length > 0 ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {qa.length > 0 ? "Mehr" : "Generieren"}
        </Button>
      </div>

      {/* Editable Q&A list */}
      <div className="space-y-2.5">
        {qa.map((item, i) => (
          <div
            key={i}
            className="space-y-1.5 rounded-md border border-border/50 bg-card/60 p-2"
          >
            <div className="flex items-start gap-1.5">
              <span className="mt-2 shrink-0 text-xs font-semibold text-violet-300">
                {i + 1}.
              </span>
              <Input
                value={item.q}
                onChange={(e) => updateItem(i, { q: e.target.value })}
                onBlur={() => persist(qa)}
                placeholder="Frage / Einwand…"
                className="h-8 flex-1 text-xs font-medium"
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="mt-2 shrink-0 text-muted-foreground/40 hover:text-rose-300"
                title="Entfernen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-end gap-1.5 pl-5">
              <Textarea
                value={item.a}
                onChange={(e) => updateItem(i, { a: e.target.value })}
                onBlur={() => persist(qa)}
                placeholder="Antwort…"
                rows={2}
                className="flex-1 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 border-violet-500/40 px-2 text-violet-200"
                disabled={answeringIdx === i}
                onClick={() => answerItem(i)}
                title="Claude formuliert die Antwort"
              >
                {answeringIdx === i ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Always-present add row */}
      <div className="space-y-1.5 rounded-md border border-dashed border-border/50 bg-background/30 p-2">
        <div className="text-[11px] font-medium text-muted-foreground">
          Eigene Frage hinzufügen
        </div>
        <Input
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
          placeholder="Frage, die dir in den Kopf kommt…"
          className="h-8 text-xs"
        />
        <div className="flex items-end gap-1.5">
          <Textarea
            value={newA}
            onChange={(e) => setNewA(e.target.value)}
            placeholder="Antwort (selbst schreiben oder Claude fragen)…"
            rows={2}
            className="flex-1 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 border-violet-500/40 px-2 text-violet-200"
            disabled={answeringNew}
            onClick={answerNew}
            title="Claude formuliert die Antwort"
          >
            {answeringNew ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <Button
          size="sm"
          className="h-7 w-full gap-1 text-[11px]"
          disabled={pending || !newQ.trim()}
          onClick={addNew}
        >
          <Plus className="h-3.5 w-3.5" /> Hinzufügen
        </Button>
      </div>
    </div>
  );
}
