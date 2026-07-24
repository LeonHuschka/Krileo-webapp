"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Globe,
  CalendarCheck,
  Server,
  LayoutDashboard,
  Mail,
  BarChart3,
  CreditCard,
  Share2,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCESS_ICONS,
  normalizeUrl,
  type AccessClient,
  type AccessIcon,
} from "@/lib/orders/access";
import {
  saveAccess,
  deleteAccess,
  revealAccessSecrets,
} from "@/app/(app)/orders/access-actions";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Globe,
  CalendarCheck,
  Server,
  LayoutDashboard,
  Mail,
  BarChart3,
  CreditCard,
  Share2,
  KeyRound,
};

function iconFor(key?: AccessIcon) {
  const name = ACCESS_ICONS.find((i) => i.key === key)?.icon ?? "KeyRound";
  return ICONS[name] ?? KeyRound;
}

type Draft = {
  id?: string;
  label: string;
  provider: string;
  url: string;
  icon: AccessIcon;
  username: string;
  password: string;
  notes: string;
};

const EMPTY: Draft = {
  label: "",
  provider: "",
  url: "",
  icon: "other",
  username: "",
  password: "",
  notes: "",
};

export function AccessPanel({
  orderId,
  accesses,
}: {
  orderId: string;
  accesses: AccessClient[];
}) {
  const [list, setList] = useState<AccessClient[]>(accesses);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  function openLogin(a: AccessClient) {
    const href = normalizeUrl(a.url);
    if (!href) {
      openEdit(a);
      return;
    }
    window.open(href, "_blank", "noreferrer,noopener");
  }

  async function openEdit(a: AccessClient) {
    setDraft({
      id: a.id,
      label: a.label,
      provider: a.provider ?? "",
      url: a.url ?? "",
      icon: a.icon ?? "other",
      username: "",
      password: "",
      notes: "",
    });
    setShowPw(false);
    setOpen(true);
    if (a.hasSecrets) {
      setLoading(true);
      try {
        const s = await revealAccessSecrets(orderId, a.id);
        setDraft((d) => ({
          ...d,
          username: s.username ?? "",
          password: s.password ?? "",
          notes: s.notes ?? "",
        }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      } finally {
        setLoading(false);
      }
    }
  }

  function openNew() {
    setDraft(EMPTY);
    setShowPw(false);
    setOpen(true);
  }

  async function save() {
    if (!draft.label.trim() && !draft.provider.trim()) {
      toast.error("Bitte mindestens ein Label oder einen Anbieter angeben.");
      return;
    }
    setSaving(true);
    try {
      const next = await saveAccess(orderId, {
        id: draft.id,
        label: draft.label || draft.provider,
        provider: draft.provider,
        url: draft.url,
        icon: draft.icon,
        secrets: {
          username: draft.username,
          password: draft.password,
          notes: draft.notes,
        },
      });
      setList(next);
      setOpen(false);
      toast.success("Zugang gespeichert");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft.id) return;
    if (!window.confirm("Diesen Zugang löschen?")) return;
    setSaving(true);
    try {
      setList(await deleteAccess(orderId, draft.id));
      setOpen(false);
      toast.success("Zugang gelöscht");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function copy(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} kopiert`);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" /> Zugänge
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={openNew}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Zugang
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
          Noch keine Zugänge. Domain-Registrar, Buchungsplattform, Hosting …
          hier hinterlegen — ein Klick öffnet die Login-Seite.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((a) => {
            const Icon = iconFor(a.icon);
            return (
              <div
                key={a.id}
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/40 p-2 pr-1.5 transition-colors hover:border-primary/40"
              >
                <button
                  type="button"
                  onClick={() => openLogin(a)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  title={a.url ? "Login-Seite öffnen" : "Bearbeiten"}
                >
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {a.label}
                    </span>
                    {a.provider && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {a.provider}
                      </span>
                    )}
                  </span>
                  {a.hasSecrets && (
                    <Lock className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                  )}
                  {a.url && (
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                  title="Bearbeiten"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" />
              {draft.id ? "Zugang bearbeiten" : "Neuer Zugang"}
              {loading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Label">
                <Input
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  placeholder="Domäne"
                  className="h-8"
                />
              </Field>
              <Field label="Typ / Icon">
                <select
                  value={draft.icon}
                  onChange={(e) => {
                    const icon = e.target.value as AccessIcon;
                    const preset = ACCESS_ICONS.find((i) => i.key === icon);
                    setDraft((d) => ({
                      ...d,
                      icon,
                      label: d.label || preset?.label || "",
                    }));
                  }}
                  className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  {ACCESS_ICONS.map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Anbieter">
                <Input
                  value={draft.provider}
                  onChange={(e) =>
                    setDraft({ ...draft, provider: e.target.value })
                  }
                  placeholder="IONOS"
                  className="h-8"
                />
              </Field>
              <Field label="Login-URL">
                <Input
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  placeholder="login.ionos.de"
                  className="h-8"
                />
              </Field>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" /> Verschlüsselt gespeichert
              </div>
              <Field label="Benutzer / Übergabenummer">
                <div className="flex gap-1.5">
                  <Input
                    value={draft.username}
                    onChange={(e) =>
                      setDraft({ ...draft, username: e.target.value })
                    }
                    placeholder="name@kunde.de"
                    className="h-8"
                  />
                  <CopyBtn onClick={() => copy(draft.username, "Benutzer")} />
                </div>
              </Field>
              <div className="mt-2">
                <Field label="Passwort / Token">
                  <div className="flex gap-1.5">
                    <Input
                      type={showPw ? "text" : "password"}
                      value={draft.password}
                      onChange={(e) =>
                        setDraft({ ...draft, password: e.target.value })
                      }
                      placeholder="••••••••"
                      className="h-8"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setShowPw((s) => !s)}
                      title={showPw ? "Verbergen" : "Anzeigen"}
                    >
                      {showPw ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <CopyBtn onClick={() => copy(draft.password, "Passwort")} />
                  </div>
                </Field>
              </div>
              <div className="mt-2">
                <Field label="Notiz (optional)">
                  <Textarea
                    value={draft.notes}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                    placeholder="2FA-Hinweis, Transfer-Code …"
                    className="min-h-[52px] text-sm"
                  />
                </Field>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            {draft.id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={remove}
                disabled={saving}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Löschen
              </Button>
            ) : (
              <span />
            )}
            <Button size="sm" onClick={save} disabled={saving || loading} className="gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="h-8 w-8 shrink-0"
      onClick={onClick}
      title="Kopieren"
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
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
