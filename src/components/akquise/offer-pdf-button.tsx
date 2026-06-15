"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getOfferDraft } from "@/app/(app)/akquise/actions";

/**
 * "Angebot" button → opens a dialog that pre-fills the order scope + the
 * negotiated price from the lead's notes (via getOfferDraft). The user
 * fills anything that wasn't found, then downloads a ready-to-send Krileo
 * "Auftrag" PDF.
 */
export function OfferPdfButton({
  leadId,
  className,
}: {
  leadId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loadingDraft, startDraft] = useTransition();
  const [generating, setGenerating] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerLines, setCustomerLines] = useState<string[]>([]);
  const [deliverable, setDeliverable] = useState("");
  const [setupEur, setSetupEur] = useState("");
  const [monthlyEur, setMonthlyEur] = useState("");
  const [priceFound, setPriceFound] = useState(true);

  function openDialog() {
    setOpen(true);
    startDraft(async () => {
      try {
        const d = await getOfferDraft(leadId);
        setCustomerName(d.customerName);
        setCustomerLines(d.customerLines);
        setDeliverable(d.deliverable ?? "");
        setSetupEur(d.setup_eur != null ? String(d.setup_eur) : "");
        setMonthlyEur(d.monthly_eur != null ? String(d.monthly_eur) : "");
        setPriceFound(d.price_found);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Laden");
      }
    });
  }

  async function generate() {
    const setup = Number(setupEur.replace(/[^\d]/g, ""));
    const monthly = monthlyEur.trim()
      ? Number(monthlyEur.replace(/[^\d]/g, ""))
      : null;
    if (!deliverable.trim()) {
      toast.error("Bitte den Auftragsumfang ausfüllen");
      return;
    }
    if (!setup || setup <= 0) {
      toast.error("Bitte einen Preis eintragen");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/akquise/leads/${leadId}/angebot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerLines,
          deliverable: deliverable.trim(),
          setup_eur: setup,
          monthly_eur: monthly,
        }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg.error || "PDF-Erstellung fehlgeschlagen");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Krileo-Auftrag-${customerName || "Kunde"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Auftrag-PDF erstellt");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className={className ?? "gap-2"}
        onClick={openDialog}
      >
        <FileText className="h-4 w-4" /> Angebot
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Auftrag / Angebot erstellen</DialogTitle>
            <DialogDescription>
              {loadingDraft
                ? "Lese Preis & Umfang aus deinen Notizen…"
                : priceFound
                  ? "Preis aus deinen Notizen übernommen — prüfen & anpassen."
                  : "Kein Preis in den Notizen gefunden — bitte eintragen."}
            </DialogDescription>
          </DialogHeader>

          {loadingDraft ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Kunde</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Das bekommen Sie (Auftragsumfang)
                </Label>
                <Textarea
                  rows={4}
                  value={deliverable}
                  onChange={(e) => setDeliverable(e.target.value)}
                  placeholder="Konkret: Was bekommt der Kunde? z.B. Eine mobile Web-App mit Online-Bestellsystem…"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Einmalig (€, netto)</Label>
                  <Input
                    inputMode="numeric"
                    value={setupEur}
                    onChange={(e) => setSetupEur(e.target.value)}
                    placeholder="z.B. 490"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Monatlich (€, netto · optional)
                  </Label>
                  <Input
                    inputMode="numeric"
                    value={monthlyEur}
                    onChange={(e) => setMonthlyEur(e.target.value)}
                    placeholder="z.B. 99"
                  />
                </div>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Monatlich leer lassen = einmaliges Projekt. Mit Monatsbetrag =
                Einrichtung + Abo (12 Monate Laufzeit).
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={generate}
              disabled={loadingDraft || generating}
              className="gap-2"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Auftrag-PDF herunterladen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
