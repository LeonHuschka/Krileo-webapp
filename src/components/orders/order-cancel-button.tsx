"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, RotateCcw, Loader2 } from "lucide-react";
import { setOrderCanceled } from "@/app/(app)/orders/actions";
import { cn } from "@/lib/utils";

export function OrderCancelButton({
  orderId,
  canceled,
  className,
}: {
  orderId: string;
  canceled: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      try {
        await setOrderCanceled(orderId, !canceled);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={pending}
      title={canceled ? "Wieder aktivieren" : "Auftrag stornieren"}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
        canceled
          ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15"
          : "border-border/60 text-muted-foreground hover:border-rose-500/50 hover:text-rose-300",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : canceled ? (
        <RotateCcw className="h-3.5 w-3.5" />
      ) : (
        <Ban className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
