"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function CategoryCombobox({
  value,
  onChange,
  predefined,
  extra = [],
  placeholder = "— Kategorie —",
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  predefined: readonly string[];
  /** Additional category names found in existing rows. */
  extra?: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const merged = useMemo(() => {
    const known = new Set(predefined);
    const extras = Array.from(new Set(extra))
      .filter((c) => c && !known.has(c))
      .sort();
    return [...predefined, ...extras];
  }, [predefined, extra]);

  const trimmed = query.trim();
  const exists = merged.some(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreate = trimmed.length > 0 && !exists;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value ? (
            <span>{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {value && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(null);
                  }
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Auswahl entfernen"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Suchen oder neu anlegen…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Keine Treffer.</CommandEmpty>
            <CommandGroup>
              {merged.map((cat) => (
                <CommandItem
                  key={cat}
                  value={cat}
                  onSelect={() => {
                    onChange(cat === value ? null : cat);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === cat ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {cat}
                </CommandItem>
              ))}
              {showCreate && (
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={() => {
                    onChange(trimmed);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className="mr-2 text-muted-foreground">Neu:</span>
                  <span className="font-medium">{trimmed}</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
