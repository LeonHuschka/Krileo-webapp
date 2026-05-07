"use client";

import { useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { tagColor } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TagInput({
  value,
  onChange,
  placeholder = "Tag + Enter",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add(t: string) {
    const tag = t.trim();
    if (!tag) return;
    if (value.includes(tag)) return;
    onChange([...value, tag]);
  }

  function remove(t: string) {
    onChange(value.filter((x) => x !== t));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      setDraft("");
    } else if (e.key === "Backspace" && draft === "" && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
      {value.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={cn(
            "gap-1 border pl-2 pr-1 text-xs font-medium",
            tagColor(tag),
          )}
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            className="rounded hover:bg-foreground/10"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (draft.trim()) {
            add(draft);
            setDraft("");
          }
        }}
        placeholder={placeholder}
        className="h-7 min-w-[120px] flex-1 border-none p-0 text-sm shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
