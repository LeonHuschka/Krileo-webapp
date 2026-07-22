"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { saveIssuer } from "@/app/(app)/settings/invoice-actions";
import type { IssuerSettings } from "@/lib/invoice/types";

export function IssuerForm({ initial }: { initial: IssuerSettings }) {
  const [s, setS] = useState<IssuerSettings>(initial);
  const [pending, start] = useTransition();
  const set = (p: Partial<IssuerSettings>) => setS((v) => ({ ...v, ...p }));

  function save() {
    start(async () => {
      try {
        await saveIssuer(s);
        toast.success("Rechnungs-Aussteller gespeichert");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-primary" />
          Rechnungs-Aussteller
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Diese Daten erscheinen auf jeder Rechnung. Name, Adresse und – falls
          vorhanden – die USt-IdNr. sind rechtlich verpflichtend.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <F label="Marke (Kopf- & Fußzeile)">
            <Input
              value={s.brandName}
              onChange={(e) => set({ brandName: e.target.value })}
              placeholder="Krileo"
              className="h-9"
            />
          </F>
          <F label="Rechnungssteller (Name, rechtlich)">
            <Input
              value={s.senderName}
              onChange={(e) => set({ senderName: e.target.value })}
              placeholder="Leon Huschka"
              className="h-9"
            />
          </F>
          <F label="USt-IdNr. / Steuernummer">
            <Input
              value={s.vatId}
              onChange={(e) => set({ vatId: e.target.value })}
              placeholder="DE123456789"
              className="h-9"
            />
          </F>
          <F label="Fußzeilen-Zusatz">
            <Input
              value={s.footerNote}
              onChange={(e) => set({ footerNote: e.target.value })}
              placeholder="Freiberufliche Agentur"
              className="h-9"
            />
          </F>
        </div>

        <F label="Adresse (eine Zeile pro Feld)">
          <Textarea
            value={s.addressLines.join("\n")}
            onChange={(e) =>
              set({
                addressLines: e.target.value
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Musterstraße 1&#10;1010 Wien&#10;Österreich"
            className="min-h-[72px] text-sm"
          />
        </F>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <F label="E-Mail">
            <Input
              value={s.email}
              onChange={(e) => set({ email: e.target.value })}
              className="h-9"
            />
          </F>
          <F label="Telefon">
            <Input
              value={s.phone}
              onChange={(e) => set({ phone: e.target.value })}
              className="h-9"
            />
          </F>
          <F label="Name (Fußzeile)">
            <Input
              value={s.gf}
              onChange={(e) => set({ gf: e.target.value })}
              placeholder="Leon Huschka"
              className="h-9"
            />
          </F>
          <F label="Zahlungsweg">
            <Input
              value={s.paymentMethod}
              onChange={(e) => set({ paymentMethod: e.target.value })}
              placeholder="Wise / Bank transfer / PayPal"
              className="h-9"
            />
          </F>
        </div>

        <F label="Zahlungsdaten (eine Zeile pro Angabe)">
          <Textarea
            value={s.paymentLines.join("\n")}
            onChange={(e) =>
              set({
                paymentLines: e.target.value
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Wise: krileoworks@gmail.com&#10;IBAN: …&#10;BIC: …"
            className="min-h-[72px] text-sm"
          />
        </F>

        <div className="flex justify-end">
          <Button onClick={save} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
