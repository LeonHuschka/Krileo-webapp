"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addLeadPhone,
  removeLeadPhone,
} from "@/app/(app)/akquise/actions";
import type { AdditionalPhone } from "@/lib/lead-engine/types";

/**
 * tel: URI handlers (macOS FaceTime, Skype, iOS Phone, Android) are
 * picky about formatting. They expect digits, an optional leading +,
 * and nothing else — spaces and parens silently break dialing on
 * desktop. Strip everything but digits and a leading +.
 */
function telHref(num: string | null | undefined): string | undefined {
  if (!num) return undefined;
  const cleaned = num.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return cleaned ? `tel:${cleaned}` : undefined;
}

/**
 * Renders the primary phone (passed in) as a big tel: button, plus
 * any additional phones the user has added, plus a "+" popover to add
 * a new one (label optional, number required).
 */
export function PhoneManager({
  leadId,
  primaryPhone,
  additional,
}: {
  leadId: string;
  primaryPhone: string | null;
  additional: AdditionalPhone[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");

  function submit() {
    if (!number.trim()) {
      toast.error("Nummer fehlt");
      return;
    }
    startTransition(async () => {
      try {
        await addLeadPhone({
          leadId,
          number: number.trim(),
          label: label.trim() || undefined,
        });
        toast.success("Nummer hinzugefügt");
        setOpen(false);
        setNumber("");
        setLabel("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function remove(idx: number) {
    startTransition(async () => {
      try {
        await removeLeadPhone(leadId, idx);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      {/* Primary number */}
      <a
        href={telHref(primaryPhone)}
        className="flex w-full items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        style={{
          pointerEvents: primaryPhone ? "auto" : "none",
          opacity: primaryPhone ? 1 : 0.5,
        }}
      >
        <Phone className="h-4 w-4" />
        <span className="font-mono text-base tracking-tight">
          {primaryPhone ?? "keine Hauptnummer"}
        </span>
        <span className="ml-auto text-[10px] uppercase opacity-70">
          Hauptnr.
        </span>
      </a>

      {/* Additional numbers */}
      {additional.map((p, i) => (
        <div key={i} className="flex items-center gap-1">
          <a
            href={telHref(p.number)}
            className="flex flex-1 items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-mono text-emerald-300 hover:bg-emerald-500/20"
          >
            <Phone className="h-3 w-3" />
            {p.number}
            {p.label && (
              <span className="ml-auto text-[10px] uppercase opacity-70">
                {p.label}
              </span>
            )}
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove(i)}
            disabled={pending}
            className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-rose-300"
            title="Nummer entfernen"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {/* Add */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            className="h-7 w-full gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Nummer hinzufügen
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-2">
          <div className="space-y-1">
            <Label htmlFor="phone-num" className="text-xs">
              Nummer
            </Label>
            <Input
              id="phone-num"
              autoFocus
              placeholder="+49 151 …"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone-label" className="text-xs">
              Label (optional)
            </Label>
            <Input
              id="phone-label"
              placeholder="z.B. Mobil Frau Müller"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          <Button
            onClick={submit}
            disabled={pending || !number.trim()}
            className="w-full"
            size="sm"
          >
            Speichern
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
