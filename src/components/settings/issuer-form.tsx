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
          Rechnungs-Aussteller (US LLC)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Diese Daten erscheinen auf jeder Rechnung. EIN, US-Adresse und
          Zahlungsdaten bitte vollständig eintragen.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <F label="Rechtlicher Firmenname">
            <Input
              value={s.legalName}
              onChange={(e) => set({ legalName: e.target.value })}
              className="h-9"
            />
          </F>
          <F label="Marke (Header/Fußzeile)">
            <Input
              value={s.brandName}
              onChange={(e) => set({ brandName: e.target.value })}
              className="h-9"
            />
          </F>
          <F label="EIN (XX-XXXXXXX)">
            <Input
              value={s.ein}
              onChange={(e) => set({ ein: e.target.value })}
              placeholder="12-3456789"
              className="h-9"
            />
          </F>
          <F label="State of Formation">
            <Input
              value={s.stateOfFormation}
              onChange={(e) => set({ stateOfFormation: e.target.value })}
              placeholder="z.B. Wyoming"
              className="h-9"
            />
          </F>
        </div>

        <F label="US-Adresse (eine Zeile pro Feld)">
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
            placeholder="123 Main St, Suite 100&#10;Sheridan, WY 82801&#10;United States"
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
          <F label="Geschäftsführung (Fußzeile)">
            <Input
              value={s.gf}
              onChange={(e) => set({ gf: e.target.value })}
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
