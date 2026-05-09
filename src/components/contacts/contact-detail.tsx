"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, History, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_COLORS,
} from "@/lib/constants";
import {
  deleteContact,
  touchContact,
  updateContact,
} from "@/app/(app)/contacts/actions";
import type { ContactRow, ContactStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { TagInput } from "@/components/contacts/tag-input";

export function ContactDetail({ contact }: { contact: ContactRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    name: contact.name,
    company: contact.company ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    location: contact.location ?? "",
    source: contact.source ?? "",
    notes: contact.notes ?? "",
    demo_url: contact.demo_url ?? "",
  });
  const [tags, setTags] = useState<string[]>(contact.tags);

  function patch(values: Record<string, unknown>) {
    startTransition(async () => {
      try {
        await updateContact(contact.id, values);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function saveTextFields() {
    patch({
      name: draft.name,
      company: draft.company || null,
      email: draft.email || null,
      phone: draft.phone || null,
      location: draft.location || null,
      source: draft.source || null,
      notes: draft.notes || null,
      demo_url: draft.demo_url || null,
    });
  }

  function saveTags(next: string[]) {
    setTags(next);
    patch({ tags: next });
  }

  function markContacted() {
    startTransition(async () => {
      try {
        await touchContact(contact.id);
        toast.success("Kontaktdatum aktualisiert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function remove() {
    if (!confirm("Kontakt wirklich löschen?")) return;
    startTransition(async () => {
      try {
        await deleteContact(contact.id);
        toast.success("Kontakt gelöscht");
        router.push("/contacts");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const lastContact = contact.last_contacted_at
    ? new Date(contact.last_contacted_at).toLocaleString("de-DE")
    : "noch nie";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex-1 space-y-2">
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onBlur={saveTextFields}
            className="border-none bg-transparent px-0 text-xl font-semibold focus-visible:ring-0 md:text-2xl"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border capitalize",
                CONTACT_STATUS_COLORS[contact.status],
              )}
            >
              {CONTACT_STATUSES.find((s) => s.value === contact.status)?.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Zuletzt kontaktiert: {lastContact}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={markContacted}
            disabled={pending}
            className="gap-1"
          >
            <History className="h-3.5 w-3.5" />
            Kontaktiert
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive"
            title="Kontakt löschen"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={contact.status}
              onValueChange={(v) => patch({ status: v as ContactStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Firma</Label>
            <Input
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
              onBlur={saveTextFields}
            />
          </div>

          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              onBlur={saveTextFields}
            />
          </div>

          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              onBlur={saveTextFields}
            />
          </div>

          <div className="space-y-2">
            <Label>Quelle</Label>
            <Input
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              onBlur={saveTextFields}
            />
          </div>

          <div className="space-y-2">
            <Label>Ort / Adresse</Label>
            <Input
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              onBlur={saveTextFields}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="demo_url">Demo-Link</Label>
          <div className="flex gap-2">
            <Input
              id="demo_url"
              type="url"
              placeholder="https://demo.krileo.de/mustermann"
              value={draft.demo_url}
              onChange={(e) =>
                setDraft({ ...draft, demo_url: e.target.value })
              }
              onBlur={saveTextFields}
            />
            {contact.demo_url && (
              <Button
                asChild
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Demo öffnen"
              >
                <a
                  href={contact.demo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <TagInput value={tags} onChange={saveTags} />
        </div>

        <div className="space-y-2">
          <Label>Notizen</Label>
          <Textarea
            rows={6}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            onBlur={saveTextFields}
            placeholder="Was ist beim letzten Gespräch passiert? Worauf achten?"
          />
        </div>
      </CardContent>
    </Card>
  );
}
