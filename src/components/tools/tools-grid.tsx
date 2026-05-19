"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToolCard } from "@/components/tools/tool-card";
import { EditToolDialog } from "@/components/tools/edit-tool-dialog";
import type { ToolRow } from "@/lib/types/database";

const ALL = "__all__";

export function ToolsGrid({
  tools,
  extraCategories,
}: {
  tools: ToolRow[];
  extraCategories: string[];
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [editing, setEditing] = useState<ToolRow | null>(null);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    tools.forEach((t) => t.category && set.add(t.category));
    return Array.from(set).sort();
  }, [tools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((t) => {
      if (categoryFilter !== ALL && t.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.category ?? "").toLowerCase().includes(q) ||
        (t.url ?? "").toLowerCase().includes(q) ||
        (t.login_email ?? "").toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [tools, query, categoryFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Kategorien</SelectItem>
            {allCategories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 p-6">
          <p className="text-sm text-muted-foreground">Keine Tools gefunden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <ToolCard key={t.id} tool={t} onClick={() => setEditing(t)} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} von {tools.length} Tools
      </p>

      <EditToolDialog
        tool={editing}
        extraCategories={extraCategories}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}
