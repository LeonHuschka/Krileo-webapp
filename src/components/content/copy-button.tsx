"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Kopieren" }: { text: string; label?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        toast.success("Kopiert");
      }}
    >
      {label}
    </Button>
  );
}
