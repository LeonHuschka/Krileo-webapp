"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Plus,
  Trash2,
  Loader2,
  Wand2,
  Circle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  initInvoiceDraft,
  regenerateInvoiceDraft,
  saveInvoiceDraft,
  markInvoiceDownloaded,
} from "@/app/(app)/orders/invoice-actions";
import {
  fmtMoney,
  invoiceTotalCents,
  vatCentsOf,
  defaultTagline,
  type InvoiceState,
  type InvoiceBillingMode,
} from "@/lib/invoice/types";
import type { OrderType } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF"];
const uid = () => crypto.randomUUID();

export function InvoiceButton({
  orderId,
  orderType,
  initialInvoice,
}: {
  orderId: string;
  orderType: OrderType;
  initialInvoice: InvoiceState | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<InvoiceState | null>(initialInvoice);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const badge = initialInvoice ?? state;
  const downloaded = !!badge?.downloadedAt;

  // Debounced autosave + preview refresh whenever the state changes.
  useEffect(() => {
    if (!open || !state) return;
    const t = setTimeout(() => void refresh(state), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, open]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  async function refresh(s: InvoiceState) {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: s }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = url;
        setPreviewUrl(url);
      }
    } catch {
      /* preview is best-effort */
    } finally {
      setBusy(false);
    }
    saveInvoiceDraft(orderId, s).catch(() => {});
  }

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !state) {
      setLoading(true);
      try {
        setState(await initInvoiceDraft(orderId));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }
  }

  async function resetDraft() {
    if (
      !window.confirm(
        "Entwurf verwerfen und komplett neu aufbauen? Positionen, Empfänger und Einstellungen werden zurückgesetzt (die Rechnungsnummer bleibt).",
      )
    )
      return;
    setLoading(true);
    try {
      const fresh = await regenerateInvoiceDraft(orderId);
      setState(fresh);
      router.refresh();
      toast.success("Entwurf zurückgesetzt");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    if (!state) return;
    const res = await fetch(`/api/orders/${orderId}/invoice`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (!res.ok) {
      toast.error("PDF konnte nicht erstellt werden");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Krileo-Rechnung-${state.number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    await markInvoiceDownloaded(orderId).catch(() => {});
    setState((s) => (s ? { ...s, downloadedAt: new Date().toISOString() } : s));
    router.refresh();
    toast.success("PDF heruntergeladen");
  }

  const patch = (p: Partial<InvoiceState>) =>
    setState((s) => (s ? { ...s, ...p } : s));
  const setItem = (id: string, p: Partial<InvoiceState["items"][number]>) =>
    setState((s) =>
      s
        ? { ...s, items: s.items.map((it) => (it.id === id ? { ...it, ...p } : it)) }
        : s,
    );
  const addItem = () =>
    setState((s) =>
      s
        ? {
            ...s,
            items: [
              ...s.items,
              { id: uid(), description: "", quantity: 1, unitCents: 0 },
            ],
          }
        : s,
    );
  const removeItem = (id: string) =>
    setState((s) =>
      s ? { ...s, items: s.items.filter((it) => it.id !== id) } : s,
    );

  const net = state ? invoiceTotalCents(state.items) : 0;
  const vat = state ? vatCentsOf(net, state.showVat, state.vatRate) : 0;
  const gross = net + vat;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => onOpenChange(true)}
        title="Rechnung erstellen / bearbeiten"
      >
        <FileText className="h-3.5 w-3.5" />
        Rechnung
        {badge &&
          (downloaded ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              <span className="text-[10px]">PDF</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400">
              <Circle className="h-2 w-2 fill-amber-400" />
              <span className="text-[10px]">Entwurf</span>
            </span>
          ))}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[90vh] w-[96vw] max-w-[1180px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 px-5 py-3 space-y-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Rechnung {state?.number ?? ""}
              {busy && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={resetDraft}
                disabled={!state || loading}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                title="Entwurf verwerfen und neu aufbauen"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Zurücksetzen
              </Button>
              <Button
                size="sm"
                onClick={download}
                disabled={!state}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" /> PDF herunterladen
              </Button>
            </div>
          </DialogHeader>

          {loading || !state ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entwurf wird
              erzeugt…
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              {/* Form */}
              <div className="min-h-0 space-y-5 overflow-y-auto border-r border-border/60 p-5">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rechnungsnummer">
                    <Input
                      defaultValue={state.number}
                      onBlur={(e) => patch({ number: e.target.value.trim() })}
                      className="h-8"
                    />
                  </Field>
                  <Field label="Währung">
                    <select
                      value={state.currency}
                      onChange={(e) => patch({ currency: e.target.value })}
                      className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Rechnungsdatum">
                    <Input
                      type="date"
                      value={state.date.slice(0, 10)}
                      onChange={(e) =>
                        patch({
                          date: new Date(e.target.value).toISOString(),
                        })
                      }
                      className="h-8"
                    />
                  </Field>
                  <Field label="Fällig am">
                    <Input
                      type="date"
                      value={state.dueDate.slice(0, 10)}
                      onChange={(e) =>
                        patch({
                          dueDate: new Date(e.target.value).toISOString(),
                        })
                      }
                      className="h-8"
                    />
                  </Field>
                </div>

                {/* Issuer (per invoice, seeded from settings) */}
                <div className="space-y-2">
                  <SectionLabel>Rechnungssteller</SectionLabel>
                  <div className="grid grid-cols-[1fr_7rem] gap-2">
                    <Field label="Name">
                      <Input
                        defaultValue={state.issuerName ?? ""}
                        onBlur={(e) => patch({ issuerName: e.target.value })}
                        placeholder="Leon Huschka"
                        className="h-8"
                      />
                    </Field>
                    <Field label="Akad. Grad">
                      <Input
                        defaultValue={state.issuerDegree ?? ""}
                        onBlur={(e) => patch({ issuerDegree: e.target.value })}
                        placeholder="M. Sc."
                        className="h-8"
                      />
                    </Field>
                  </div>
                  <Field label="Anschrift (c/o Korrespondenzadresse)">
                    <Textarea
                      defaultValue={(state.issuerAddressLines ?? []).join("\n")}
                      onBlur={(e) =>
                        patch({
                          issuerAddressLines: e.target.value
                            .split("\n")
                            .map((l) => l.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="c/o Max Mustermann&#10;Musterstraße 12&#10;80331 München"
                      className="min-h-[60px] text-sm"
                    />
                  </Field>
                </div>

                {/* Recipient */}
                <div className="space-y-2">
                  <SectionLabel>Rechnungsempfänger</SectionLabel>
                  <Field label="Name / Firma">
                    <Input
                      defaultValue={state.recipient.name}
                      onBlur={(e) =>
                        patch({
                          recipient: { ...state.recipient, name: e.target.value },
                        })
                      }
                      placeholder="Kunde / Firma"
                      className="h-8"
                    />
                  </Field>
                  <Field label="Anschrift">
                    <Textarea
                      defaultValue={state.recipient.addressLines.join("\n")}
                      onBlur={(e) =>
                        patch({
                          recipient: {
                            ...state.recipient,
                            addressLines: e.target.value
                              .split("\n")
                              .map((l) => l.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      placeholder="Ansprechpartner&#10;Straße&#10;PLZ Ort"
                      className="min-h-[64px] text-sm"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="E-Mail">
                      <Input
                        defaultValue={state.recipient.email ?? ""}
                        onBlur={(e) =>
                          patch({
                            recipient: {
                              ...state.recipient,
                              email: e.target.value.trim() || undefined,
                            },
                          })
                        }
                        placeholder="optional"
                        className="h-8"
                      />
                    </Field>
                    <Field label="USt-IdNr.">
                      <Input
                        defaultValue={state.recipient.taxId ?? ""}
                        onBlur={(e) =>
                          patch({
                            recipient: {
                              ...state.recipient,
                              taxId: e.target.value.trim() || undefined,
                            },
                          })
                        }
                        placeholder="optional"
                        className="h-8"
                      />
                    </Field>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <SectionLabel>Positionen</SectionLabel>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addItem}
                      className="h-7 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Position
                    </Button>
                  </div>
                  <div className="grid grid-cols-[1fr_3rem_5rem_1.25rem] gap-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>Leistung</span>
                    <span className="text-right">Menge</span>
                    <span className="text-right">Einzel</span>
                    <span />
                  </div>
                  {state.items.map((it) => (
                    <div
                      key={it.id}
                      className="grid grid-cols-[1fr_3rem_5rem_1.25rem] items-center gap-2"
                    >
                      <Input
                        defaultValue={it.description}
                        onBlur={(e) =>
                          setItem(it.id, { description: e.target.value })
                        }
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        min={1}
                        defaultValue={it.quantity}
                        onBlur={(e) =>
                          setItem(it.id, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="h-8 px-1 text-right text-sm"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={(it.unitCents / 100).toFixed(2)}
                        onBlur={(e) =>
                          setItem(it.id, {
                            unitCents: Math.round(
                              (Number(e.target.value) || 0) * 100,
                            ),
                          })
                        }
                        className="h-8 px-1 text-right text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="text-muted-foreground/40 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="space-y-1 border-t border-border/60 pt-2 text-sm">
                    {state.showVat && (
                      <>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Netto</span>
                          <span>{fmtMoney(net, state.currency)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>USt {state.vatRate}%</span>
                          <span>{fmtMoney(vat, state.currency)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gesamt</span>
                      <span className="font-semibold">
                        {fmtMoney(gross, state.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* VAT display */}
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/10 p-2.5">
                  <div className="min-w-0">
                    <div className="text-sm">USt ausweisen</div>
                    <div className="text-[11px] text-muted-foreground">
                      Zeigt eine USt-Zeile & Bruttosumme; der Reverse-Charge-Vermerk
                      bleibt unten.
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {state.showVat && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={state.vatRate}
                          onChange={(e) =>
                            patch({ vatRate: Number(e.target.value) || 0 })
                          }
                          className="h-8 w-14 px-1 text-right text-sm"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => patch({ showVat: !state.showVat })}
                      className={cn(
                        "relative h-5 w-9 rounded-full transition-colors",
                        state.showVat ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                          state.showVat ? "left-4" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Billing mode */}
                <div className="space-y-2">
                  <SectionLabel>Abrechnungsmodus</SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        [null, "Kein Vermerk"],
                        ["fixed", "Fixbetrag (Scope frei)"],
                        ["service", "Service-Vertrag"],
                      ] as [InvoiceBillingMode | null, string][]
                    ).map(([mode, label]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => patch({ billingMode: mode })}
                        className={cn(
                          "rounded-md border px-2.5 py-1.5 text-xs",
                          state.billingMode === mode
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border/60 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {state.billingMode === "service" && (
                    <p className="text-[11px] text-amber-400">
                      Service-Vertrag: das eigene Vertrags-Dokument kommt als
                      Stufe 2.
                    </p>
                  )}
                </div>

                {/* Footer tagline */}
                <Field label="Fußzeile rechts (Branding)">
                  <div className="flex gap-1.5">
                    <Input
                      value={state.taglineRight}
                      onChange={(e) => patch({ taglineRight: e.target.value })}
                      className="h-8"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        patch({ taglineRight: defaultTagline(orderType) })
                      }
                      title="Aus Auftragstyp vorschlagen"
                      className="h-8 shrink-0 px-2"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Field>

                {/* Notes */}
                <Field label="Zusätzliche Notiz (optional)">
                  <Textarea
                    defaultValue={state.notes}
                    onBlur={(e) => patch({ notes: e.target.value })}
                    className="min-h-[56px] text-sm"
                  />
                </Field>
              </div>

              {/* Preview */}
              <div className="relative min-h-0 bg-muted/30">
                {previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title="Rechnungs-Vorschau"
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Vorschau…
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}
