"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircleQuestion, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generatePrepQuestions } from "@/app/(app)/akquise/actions";

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

  function generate() {
    startTransition(async () => {
      try {
        const next = await generatePrepQuestions({
          leadId,
          focus: focus.trim() || undefined,
        });
        setQa(next);
        toast.success("Gesprächsvorbereitung erstellt");
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
        Claude generiert die Fragen + Einwände, die der Inhaber im Gespräch fast
        sicher bringt — mit fertigen Antworten zum Sagen.
      </p>
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
          {qa.length > 0 ? "Neu" : "Fragen generieren"}
        </Button>
      </div>

      {qa.length > 0 && (
        <ol className="space-y-2.5">
          {qa.map((item, i) => (
            <li
              key={i}
              className="rounded-md border border-border/50 bg-card/60 p-2.5"
            >
              <div className="flex gap-2 text-sm font-medium">
                <span className="text-violet-300">{i + 1}.</span>
                <span>{item.q}</span>
              </div>
              <div className="mt-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                → {item.a}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
