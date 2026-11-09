"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Download,
  FileSignature,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  initContractDraft,
  markContractDownloaded,
  regenerateContractDraft,
  saveContractDraft,
} from "@/app/(app)/orders/contract-actions";
import type { ContractState } from "@/lib/contract/types";

const uid = () => crypto.randomUUID();

export function ContractButton({
  orderId,
  initialContract,
}: {
  orderId: string;
  initialContract: ContractState | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ContractState | null>(initialContract);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const badge = initialContract ?? state;
  const downloaded = !!badge?.downloadedAt;

  useEffect(() => {
    if (!open || !state) return;
    const t = setTimeout(() => void refresh(state), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, open]);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  async function render(s: ContractState) {
    const res = await fetch(`/api/orders/${orderId}/contract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: s }),
    });
    return res.ok ? res.blob() : null;
  }

  async function refresh(s: ContractState) {
    setBusy(true);
    try {
      const blob = await render(s);
      if (blob) {
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
    saveContractDraft(orderId, s).catch(() => {});
  }

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      router.refresh();
      return;
    }
    if (!state) {
      setLoading(true);
      try {
        setState(await initContractDraft(orderId));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }
  }

  async function reset() {
    if (!window.confirm("Vertragsentwurf verwerfen und mit Standardwerten neu aufbauen?")) return;
    setLoading(true);
    try {
      setState(await regenerateContractDraft(orderId));
      toast.success("Entwurf zurückgesetzt");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    if (!state) return;
    const blob = await render(state);
    if (!blob) {
      toast.error("PDF konnte nicht erstellt werden");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Krileo-Servicevertrag-${state.number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    await markContractDownloaded(orderId).catch(() => {});
    setState((s) => (s ? { ...s, downloadedAt: new Date().toISOString() } : s));
    toast.success("PDF heruntergeladen");
  }

  const patch = (p: Partial<ContractState>) => setState((s) => (s ? { ...s, ...p } : s));
  const patchRecipient = (p: Partial<ContractState["recipient"]>) =>
    setState((s) => (s ? { ...s, recipient: { ...s.recipient, ...p } } : s));
  const num = (v: string, min = 0) => Math.max(min, Math.round(Number(v) || 0));

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => onOpenChange(true)}
        title="Servicevertrag erstellen / bearbeiten"
      >
        <FileSignature className="h-3.5 w-3.5" />
        Vertrag
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
          <DialogHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/60 px-5 py-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSignature className="h-4 w-4 text-primary" />
              Servicevertrag {state?.number ?? ""}
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={reset}
                disabled={!state || loading}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Zurücksetzen
              </Button>
              <Button size="sm" onClick={download} disabled={!state} className="gap-1.5">
                <Download className="h-4 w-4" /> PDF herunterladen
              </Button>
            </div>
          </DialogHeader>

          {loading || !state ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entwurf wird erzeugt…
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <div className="min-h-0 space-y-5 overflow-y-auto border-r border-border/60 p-5">
                {/* Basics */}
                <div className="space-y-2">
                  <Section>Vertrag</Section>
                  <Field label="Leistung / Titel">
                    <Input
                      defaultValue={state.title}
                      onBlur={(e) => patch({ title: e.target.value })}
                      placeholder="Website-Betreuung & Wartung"
                      className="h-8"
                    />
                  </Field>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Vertragsnummer">
                      <Input
                        defaultValue={state.number}
                        onBlur={(e) => patch({ number: e.target.value.trim() })}
                        className="h-8"
                      />
                    </Field>
                    <Field label="Vertragsdatum">
                      <Input
                        type="date"
                        value={state.date.slice(0, 10)}
                        onChange={(e) =>
                          e.target.value &&
                          patch({ date: new Date(`${e.target.value}T12:00:00`).toISOString() })
                        }
                        className="h-8"
                      />
                    </Field>
                    <Field label="Beginn">
                      <Input
                        type="date"
                        value={state.start}
                        onChange={(e) => patch({ start: e.target.value })}
                        className="h-8"
                      />
                    </Field>
                  </div>
                </div>

                {/* Money & term */}
                <div className="space-y-2">
                  <Section>Vergütung & Laufzeit</Section>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Monatlich (€)">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={(state.monthlyCents / 100).toFixed(2)}
                        onBlur={(e) =>
                          patch({ monthlyCents: Math.round((Number(e.target.value) || 0) * 100) })
                        }
                        className="h-8"
                      />
                    </Field>
                    <Field label="Mindestlaufzeit (Monate)">
                      <Input
                        type="number"
                        min={1}
                        value={state.minTermMonths}
                        onChange={(e) => patch({ minTermMonths: num(e.target.value, 1) })}
                        className="h-8"
                      />
                    </Field>
                    <Field label="Kündigungsfrist (Monate)">
                      <Input
                        type="number"
                        min={1}
                        value={state.noticeMonths}
                        onChange={(e) => patch({ noticeMonths: num(e.target.value, 1) })}
                        className="h-8"
                      />
                    </Field>
                    <Field label="Zahlungsziel (Tage)">
                      <Input
                        type="number"
                        min={0}
                        value={state.paymentDays}
                        onChange={(e) => patch({ paymentDays: num(e.target.value) })}
                        className="h-8"
                      />
                    </Field>
                    <Field label="Stundensatz Extras (€)">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={(state.hourlyRateCents / 100).toFixed(2)}
                        onBlur={(e) =>
                          patch({
                            hourlyRateCents: Math.round((Number(e.target.value) || 0) * 100),
                          })
                        }
                        className="h-8"
                      />
                    </Field>
                  </div>
                </div>

                {/* Client */}
                <div className="space-y-2">
                  <Section>Auftraggeber</Section>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name">
                      <Input
                        defaultValue={state.recipient.name}
                        onBlur={(e) => patchRecipient({ name: e.target.value })}
                        className="h-8"
                      />
                    </Field>
                    <Field label="Firma">
                      <Input
                        defaultValue={state.recipient.company ?? ""}
                        onBlur={(e) => patchRecipient({ company: e.target.value.trim() || undefined })}
                        className="h-8"
                      />
                    </Field>
                  </div>
                  <Field label="Straße & Hausnummer">
                    <Input
                      defaultValue={state.recipient.street ?? ""}
                      onBlur={(e) => patchRecipient({ street: e.target.value })}
                      className="h-8"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="PLZ & Ort">
                      <Input
                        defaultValue={state.recipient.city ?? ""}
                        onBlur={(e) => patchRecipient({ city: e.target.value })}
                        className="h-8"
                      />
                    </Field>
                    <Field label="Land">
                      <Input
                        defaultValue={state.recipient.country ?? ""}
                        onBlur={(e) => patchRecipient({ country: e.target.value })}
                        className="h-8"
                      />
                    </Field>
                  </div>
                </div>

                {/* Scope */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Section>Leistungsumfang</Section>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      onClick={() =>
                        patch({ services: [...state.services, { id: uid(), text: "" }] })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> Leistung
                    </Button>
                  </div>
                  {state.services.map((sv) => (
                    <div key={sv.id} className="flex items-center gap-2">
                      <Input
                        defaultValue={sv.text}
                        onBlur={(e) =>
                          patch({
                            services: state.services.map((x) =>
                              x.id === sv.id ? { ...x, text: e.target.value } : x,
                            ),
                          })
                        }
                        className="h-8 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patch({ services: state.services.filter((x) => x.id !== sv.id) })
                        }
                        className="text-muted-foreground/40 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Field label="Nicht enthalten (optional)">
                    <Textarea
                      defaultValue={state.excluded}
                      onBlur={(e) => patch({ excluded: e.target.value })}
                      className="min-h-[48px] text-sm"
                    />
                  </Field>
                  <Field label="Reaktionszeit (optional)">
                    <Input
                      defaultValue={state.responseTime}
                      onBlur={(e) => patch({ responseTime: e.target.value })}
                      className="h-8"
                    />
                  </Field>
                </div>

                <Field label="Sonstige Vereinbarungen (optional)">
                  <Textarea
                    defaultValue={state.notes}
                    onBlur={(e) => patch({ notes: e.target.value })}
                    className="min-h-[56px] text-sm"
                  />
                </Field>

                <p className="text-[11px] text-muted-foreground">
                  Standardvertrag als Vorlage — bei Bedarf vor dem Versand juristisch prüfen lassen.
                </p>
              </div>

              <div className="relative min-h-0 bg-muted/30">
                {previewUrl ? (
                  <iframe src={previewUrl} title="Vertrags-Vorschau" className="h-full w-full" />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}
