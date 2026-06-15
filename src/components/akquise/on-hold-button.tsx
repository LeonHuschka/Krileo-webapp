"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PauseCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { putLeadOnHold } from "@/app/(app)/akquise/actions";

export function OnHoldButton({
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

  function onHold() {
    if (
      !window.confirm(
        "Lead auf Hold setzen? Es wird automatisch ein Follow-up-Rückruf (+7 Tage) + ein kurzes Briefing aus deinen Notes angelegt.",
      )
    )
      return;
    startTransition(async () => {
      try {
        await putLeadOnHold(leadId);
        toast.success("Auf Hold — Follow-up in 7 Tagen angelegt");
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
      onClick={onHold}
      title="Lead parken + Follow-up-Routine anlegen"
    >
      {pending ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
      )}
      On Hold
    </Button>
  );
}
