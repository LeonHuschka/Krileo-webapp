"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Compass, ListPlus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  triggerEnrich,
  triggerGenerateTasks,
  triggerRoute,
  triggerScore,
} from "@/app/(app)/akquise/actions";

export function PipelineTriggers() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  function run(
    key: string,
    action: () => Promise<unknown>,
    label: string,
  ) {
    setActiveAction(key);
    startTransition(async () => {
      try {
        const result = await action();
        toast.success(`${label} fertig`, {
          description: JSON.stringify(result),
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      } finally {
        setActiveAction(null);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => run("enrich", () => triggerEnrich(), "Enrichment")}
        disabled={pending}
        className="gap-1.5"
      >
        {pending && activeAction === "enrich" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Search className="h-3.5 w-3.5" />
        )}
        Inhaber suchen (Impressum)
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => run("score", () => triggerScore(), "Scoring")}
        disabled={pending}
        className="gap-1.5"
      >
        {pending && activeAction === "score" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
        Score offene Leads
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => run("route", () => triggerRoute(), "Routing")}
        disabled={pending}
        className="gap-1.5"
      >
        {pending && activeAction === "route" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Compass className="h-3.5 w-3.5" />
        )}
        Channel-Routing
      </Button>
      <Button
        size="sm"
        onClick={() =>
          run("tasks", () => triggerGenerateTasks(), "Task-Queue")
        }
        disabled={pending}
        className="gap-1.5"
      >
        {pending && activeAction === "tasks" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ListPlus className="h-3.5 w-3.5" />
        )}
        Tages-Queue generieren
      </Button>
    </div>
  );
}
