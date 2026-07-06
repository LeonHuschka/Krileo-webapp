"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { updateOrder } from "@/app/(app)/orders/actions";

export function NotesPanel({
  orderId,
  initialNotes,
}: {
  orderId: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [saving, startSave] = useTransition();

  function save() {
    if (notes === initialNotes) return;
    startSave(async () => {
      try {
        await updateOrder(orderId, { description: notes || null });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Anforderungen & Notizen</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={save}
          placeholder="Kundenanforderungen, Wünsche, Kontext — alles was das Technik-Team wissen muss. Die Entwickler brechen sich daraus unten ihre Tasks runter."
        />
        {saving && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">Speichere…</p>
        )}
      </CardContent>
    </Card>
  );
}
