"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { forceLeadStatus } from "@/app/(app)/akquise/actions";

/**
 * Mark a lead as sold (won) straight from the lead card — it then shows up
 * under Akquise → Abschlüsse and drops out of the active queues. Saves having
 * to leave and search for the lead elsewhere.
 */
export function MarkWonButton({
  leadId,
  variant = "outline",
  className,
  size = "sm",
}: {
  leadId: string;
  variant?: "outline" | "default" | "ghost";
  className?: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function markWon() {
    if (!window.confirm("Diesen Lead als Verkauf markieren?")) return;
    startTransition(async () => {
      try {
        await forceLeadStatus(leadId, "won");
        toast.success("Als Verkauf markiert — jetzt unter Abschlüsse");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={pending}
      onClick={markWon}
      title="Lead als Verkauf markieren"
    >
      {pending ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trophy className="mr-1.5 h-3.5 w-3.5" />
      )}
      Verkauf
    </Button>
  );
}
