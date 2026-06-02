"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal,
  RotateCcw,
  Trophy,
  XCircle,
  Ban,
  Loader2,
  Phone,
  Mail,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteSingleLead,
  forceLeadStatus,
  requeueLeadToCallQueue,
  setLeadChannel,
} from "@/app/(app)/akquise/actions";
import type { Lead } from "@/lib/lead-engine/types";

/**
 * Per-row dropdown menu in the lead browser. Covers the "I clicked the
 * wrong button" and "I want to manually override" cases.
 */
export function LeadRowActions({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(label: string, fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const closed = ["won", "lost", "suppressed"].includes(lead.outreach_status);
  const isQueued =
    !closed &&
    (lead.last_contact_outcome != null || lead.next_action_at != null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="h-7 w-7 p-0"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MoreHorizontal className="h-3.5 w-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">
          Lead-Aktionen
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {(closed || isQueued) && (
          <DropdownMenuItem
            onClick={() =>
              run("Zurück in Pool", () => requeueLeadToCallQueue(lead.id))
            }
            className="gap-2 text-sm"
          >
            <RotateCcw className="h-3.5 w-3.5 text-emerald-300" />
            Zurück in Call-Queue
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
          Channel
        </DropdownMenuLabel>
        <DropdownMenuItem
          disabled={lead.primary_channel === "call" || !lead.phone}
          onClick={() => run("→ Call", () => setLeadChannel(lead.id, "call"))}
          className="gap-2 text-sm"
        >
          <Phone className="h-3.5 w-3.5 text-emerald-300" />
          Channel → Call
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={lead.primary_channel === "email" || !lead.owner_email}
          onClick={() => run("→ Mail", () => setLeadChannel(lead.id, "email"))}
          className="gap-2 text-sm"
        >
          <Mail className="h-3.5 w-3.5 text-sky-300" />
          Channel → Mail
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
          Status hart setzen
        </DropdownMenuLabel>
        <DropdownMenuItem
          disabled={lead.outreach_status === "won"}
          onClick={() =>
            run("Als Verkauf markiert", () =>
              forceLeadStatus(lead.id, "won"),
            )
          }
          className="gap-2 text-sm"
        >
          <Trophy className="h-3.5 w-3.5 text-amber-300" />
          Als Verkauf markieren
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={lead.outreach_status === "lost"}
          onClick={() =>
            run("Als verloren markiert", () =>
              forceLeadStatus(lead.id, "lost"),
            )
          }
          className="gap-2 text-sm"
        >
          <XCircle className="h-3.5 w-3.5 text-rose-300" />
          Als verloren markieren
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={lead.outreach_status === "suppressed"}
          onClick={() =>
            run("Auf DNC gesetzt", () =>
              forceLeadStatus(lead.id, "suppressed"),
            )
          }
          className="gap-2 text-sm text-rose-300"
        >
          <Ban className="h-3.5 w-3.5" />
          DNC (do-not-contact)
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            if (
              !confirm(
                `Lead "${lead.business_name}" endgültig löschen?\n\nNicht rückgängig.`,
              )
            )
              return;
            run("Lead gelöscht", () => deleteSingleLead(lead.id));
          }}
          className="gap-2 text-sm text-rose-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Lead löschen (endgültig)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
