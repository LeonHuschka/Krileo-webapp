"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { List, LayoutGrid, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export type QueueView = "list" | "cards" | "single";

export function ViewSwitcher({ current }: { current: QueueView }) {
  const router = useRouter();
  const params = useSearchParams();

  function setView(next: QueueView) {
    const p = new URLSearchParams(params.toString());
    p.set("view", next);
    // Reset index when switching away from single view
    if (next !== "single") p.delete("i");
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  const options: Array<{ value: QueueView; label: string; icon: typeof List }> = [
    { value: "list", label: "Liste", icon: List },
    { value: "cards", label: "Cards", icon: LayoutGrid },
    { value: "single", label: "Einzeln", icon: Square },
  ];

  return (
    <div className="inline-flex items-center rounded-lg border border-border/60 bg-card/60 p-0.5">
      {options.map((o) => {
        const Icon = o.icon;
        const active = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setView(o.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-card hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
