"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerScore } from "@/app/(app)/akquise/actions";

export function RescoreButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function rescore() {
    startTransition(async () => {
      try {
        await triggerScore(leadId);
        toast.success("Lead neu gescored");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={rescore}
      disabled={pending}
      className="gap-1.5"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Bot className="h-3.5 w-3.5" />
      )}
      Re-Score
    </Button>
  );
}
