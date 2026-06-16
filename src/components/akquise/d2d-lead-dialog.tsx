"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DoorOpen, Loader2, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addD2DLead,
  previewD2DMapsUrl,
} from "@/app/(app)/akquise/actions";

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function D2DLeadDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fetching, setFetching] = useState(false);

  // Form fields
  const [mapsUrl, setMapsUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("");

  // Meeting context
  const [metAt, setMetAt] = useState(() =>
    toLocalInputValue(new Date().toISOString()),
  );
  const [metLocation, setMetLocation] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextStepAt, setNextStepAt] = useState("");

  function resetForm() {
    setMapsUrl("");
    setBusinessName("");
    setOwnerName("");
    setPhone("");
    setEmail("");
    setWebsite("");
    setCity("");
    setAddress("");
    setCategory("");
    setMetAt(toLocalInputValue(new Date().toISOString()));
    setMetLocation("");
    setMeetingNotes("");
    setNextStep("");
    setNextStepAt("");
  }

  async function prefillFromMaps() {
    if (!mapsUrl.trim()) {
      toast.error("Bitte Maps-URL einfügen");
      return;
    }
    setFetching(true);
    try {
      const res = await previewD2DMapsUrl(mapsUrl);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const r = res.data;
      if (!r.raw) {
        toast.warning("Maps hat nichts geliefert — bitte manuell ausfüllen");
        return;
      }
      if (r.businessName) setBusinessName(r.businessName);
      if (r.ownerName) setOwnerName(r.ownerName);
      if (r.phone) setPhone(r.phone);
      if (r.websiteUrl) setWebsite(r.websiteUrl);
      if (r.ownerEmail) setEmail(r.ownerEmail);
      if (r.city) setCity(r.city);
      if (r.address) setAddress(r.address);
      if (r.category) setCategory(r.category);
      const extras = [
        r.ownerName ? "Inhaber" : null,
        r.ownerEmail ? "E-Mail" : null,
      ].filter(Boolean);
      toast.success(
        `Daten gezogen: ${r.businessName ?? "—"}${extras.length ? ` (+ ${extras.join(" + ")})` : ""}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Maps-Scrape Fehler");
    } finally {
      setFetching(false);
    }
  }

  function submit() {
    if (!businessName.trim()) {
      toast.error("Business-Name fehlt");
      return;
    }
    startTransition(async () => {
      try {
        await addD2DLead({
          businessName,
          ownerName: ownerName || undefined,
          phone: phone || undefined,
          ownerEmail: email || undefined,
          websiteUrl: website || undefined,
          googleMapsUrl: mapsUrl || undefined,
          city: city || undefined,
          address: address || undefined,
          category: category || undefined,
          metAt: metAt ? new Date(metAt).toISOString() : undefined,
          metLocation: metLocation || undefined,
          meetingNotes: meetingNotes || undefined,
          nextStep: nextStep || undefined,
          nextStepAt: nextStepAt
            ? new Date(nextStepAt).toISOString()
            : undefined,
        });
        toast.success(`D2D-Lead angelegt: ${businessName}`);
        setOpen(false);
        resetForm();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg" className="gap-2">
            <DoorOpen className="h-4 w-4" />
            D2D-Lead anlegen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-primary" />
            D2D-Lead anlegen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Maps URL pre-fill */}
          <div className="space-y-2 rounded-lg border border-border/60 bg-card/50 p-3">
            <Label htmlFor="maps-url" className="text-xs">
              Google-Maps-Link (optional, holt Daten automatisch)
            </Label>
            <div className="flex gap-2">
              <Input
                id="maps-url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/?cid=…"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={prefillFromMaps}
                disabled={fetching || !mapsUrl.trim()}
                size="sm"
                variant="outline"
                className="gap-1.5"
              >
                {fetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Holen
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Tipp: Auf dem iPhone in Maps → Teilen → Link kopieren → einfügen
            </p>
          </div>

          {/* Business identity */}
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Business
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz" className="text-xs">
                Business-Name *
              </Label>
              <Input
                id="biz"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="z.B. Copy Shop Mitte"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="owner" className="text-xs">
                  Inhaber/in
                </Label>
                <Input
                  id="owner"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Vor- und Nachname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat" className="text-xs">
                  Kategorie
                </Label>
                <Input
                  id="cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="z.B. Druckerei"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="ph" className="text-xs">
                  Telefon
                </Label>
                <Input
                  id="ph"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+49 …"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="em" className="text-xs">
                  E-Mail
                </Label>
                <Input
                  id="em"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@…"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="cty" className="text-xs">
                  Stadt
                </Label>
                <Input
                  id="cty"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="web" className="text-xs">
                  Website
                </Label>
                <Input
                  id="web"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
          </div>

          {/* Meeting context */}
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/[0.04] p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
              <MapPin className="h-3 w-3" />
              Begegnung
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="met-at" className="text-xs">
                  Wann getroffen
                </Label>
                <Input
                  id="met-at"
                  type="datetime-local"
                  value={metAt}
                  onChange={(e) => setMetAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="met-loc" className="text-xs">
                  Wo
                </Label>
                <Input
                  id="met-loc"
                  value={metLocation}
                  onChange={(e) => setMetLocation(e.target.value)}
                  placeholder="z.B. In der Filiale"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-xs">
                Was wurde besprochen?
              </Label>
              <Textarea
                id="notes"
                rows={3}
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                placeholder="Pain Points, Interesse, was er/sie braucht…"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="next" className="text-xs">
                  Next Step
                </Label>
                <Input
                  id="next"
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="z.B. Angebot schicken"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next-at" className="text-xs">
                  Deadline
                </Label>
                <Input
                  id="next-at"
                  type="datetime-local"
                  value={nextStepAt}
                  onChange={(e) => setNextStepAt(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending || !businessName.trim()}>
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Anlegen…
              </>
            ) : (
              "Lead anlegen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
