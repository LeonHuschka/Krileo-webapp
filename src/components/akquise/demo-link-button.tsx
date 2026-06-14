"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MonitorPlay, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setLeadDemoUrl } from "@/app/(app)/akquise/actions";

export function DemoLinkButton({
  leadId,
  demoUrl,
}: {
  leadId: string;
  demoUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function edit() {
    const url = window.prompt(
      "Demo-Link (Vercel-URL) für diesen Lead:",
      demoUrl ?? "https://",
    );
    if (url === null) return;
    startTransition(async () => {
      try {
        await setLeadDemoUrl(leadId, url.trim() || null);
        toast.success(url.trim() ? "Demo-Link gespeichert" : "Demo-Link entfernt");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  if (!demoUrl) {
    return (
      <Button
        variant="outline"
        className="gap-2"
        onClick={edit}
        disabled={pending}
      >
        <Plus className="h-4 w-4" /> Demo-Link
      </Button>
    );
  }

  return (
    <div className="flex">
      <Button
        asChild
        className="flex-1 gap-2 rounded-r-none bg-violet-600 text-white hover:bg-violet-700"
      >
        <a href={demoUrl} target="_blank" rel="noopener noreferrer">
          <MonitorPlay className="h-4 w-4" /> Demo öffnen
        </a>
      </Button>
      <Button
        variant="outline"
        className="rounded-l-none border-l-0 px-2"
        onClick={edit}
        disabled={pending}
        title="Link ändern"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
