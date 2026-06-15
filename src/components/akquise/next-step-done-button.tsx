"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeNextStep } from "@/app/(app)/akquise/actions";

/**
 * "Erledigt" — marks a lead's next-step as handled (clears next_step +
 * next_step_at, lifts on-hold). The card stops showing the overdue state.
 */
export function NextStepDoneButton({
  leadId,
  size = "sm",
  className,
}: {
  leadId: string;
  size?: "sm" | "default" | "icon";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function done() {
    startTransition(async () => {
      try {
        await completeNextStep(leadId);
        toast.success("Next-Step erledigt");
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
      variant="outline"
      onClick={done}
      disabled={pending}
      className={
        className ??
        "gap-1.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
      }
      title="Next-Step als erledigt markieren"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
      Erledigt
    </Button>
  );
}
