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

  // own-question draft
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [answering, setAnswering] = useState(false);

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

  function removeItem(idx: number) {
    const next = qa.filter((_, i) => i !== idx);
    setQa(next);
    startTransition(async () => {
      try {
        await savePrepQa(leadId, next);
      } catch {
        /* */
      }
    });
  }

  async function claudeAnswer() {
    if (!newQ.trim()) {
      toast.error("Erst deine Frage eintippen");
      return;
    }
    setAnswering(true);
    try {
      const a = await answerPrepQuestion({ leadId, question: newQ.trim() });
      setNewA(a);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setAnswering(false);
    }
  }

  function addOwn() {
    if (!newQ.trim()) {
      toast.error("Frage fehlt");
      return;
    }
    const next = [...qa, { q: newQ.trim(), a: newA.trim() }];
    setQa(next);
    setNewQ("");
    setNewA("");
    startTransition(async () => {
      try {
        await savePrepQa(leadId, next);
        toast.success("Frage hinzugefügt");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-violet-500/25 bg-violet-500/[0.04] p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-violet-300">
        <MessageCircleQuestion className="h-3.5 w-3.5" /> Gesprächsvorbereitung
      </div>
      <p className="text-[11px] text-muted-foreground">
        Claude generiert die Fragen + Einwände, die der Inhaber fast sicher
        bringt — mit fertigen Antworten. Oder füll eigene Fragen rein, Claude
        hilft bei der Antwort.
      </p>

      {/* AI generate */}
      <div className="flex gap-1.5">
        <Input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder='Optional: Fokus — z.B. "skeptisch beim Preis", "hat schon Agentur"'
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
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : qa.length > 0 ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {qa.length > 0 ? "Mehr" : "Generieren"}
        </Button>
      </div>

      {/* Q&A list */}
      {qa.length > 0 && (
        <ol className="space-y-2.5">
          {qa.map((item, i) => (
            <li
              key={i}
              className="group relative rounded-md border border-border/50 bg-card/60 p-2.5"
            >
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="absolute right-1.5 top-1.5 text-muted-foreground/40 hover:text-rose-300"
                title="Entfernen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex gap-2 pr-5 text-sm font-medium">
                <span className="text-violet-300">{i + 1}.</span>
                <span>{item.q}</span>
              </div>
              {item.a && (
                <div className="mt-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                  → {item.a}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* Own question */}
      <div className="space-y-1.5 rounded-md border border-dashed border-border/50 bg-background/30 p-2.5">
        <div className="text-[11px] font-medium text-muted-foreground">
          Eigene Frage hinzufügen
        </div>
        <Input
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
          placeholder="Frage, die dir in den Kopf kommt…"
          className="h-8 text-xs"
        />
        <div className="relative">
          <Textarea
            value={newA}
            onChange={(e) => setNewA(e.target.value)}
            placeholder="Antwort (selbst schreiben oder Claude fragen)…"
            rows={2}
            className="text-xs"
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-violet-500/40 px-2 text-[11px] text-violet-200"
            disabled={answering || pending}
            onClick={claudeAnswer}
          >
            {answering ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Claude-Antwort
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={pending || !newQ.trim()}
            onClick={addOwn}
          >
            <Plus className="h-3.5 w-3.5" /> Hinzufügen
          </Button>
        </div>
      </div>
    </div>
  );
}
