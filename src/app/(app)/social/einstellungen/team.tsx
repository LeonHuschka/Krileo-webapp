import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/content/action-form";
import { CopyButton } from "@/components/content/copy-button";
import { appUrl, contentDb } from "@/lib/content/db";
import type { ContentClient, ContentFormat, ContentMember } from "@/lib/content/types";
import { DEFAULT_AREAS } from "@/lib/content/types";
import { deleteFormat, newMemberLink, saveFormat, saveMember, toggleMember } from "../actions";
import { Glass, inputCls } from "../shared";

function AreaList() {
  return (
    <datalist id="areas">
      {DEFAULT_AREAS.map((a) => (
        <option key={a} value={a} />
      ))}
    </datalist>
  );
}

export async function TeamSection({ client }: { client: ContentClient }) {
  const { data } = await contentDb().from("content_members").select("*").eq("client_id", client.id).order("position");
  const members = (data ?? []) as ContentMember[];
  const base = appUrl();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Jede Mitarbeiterin bekommt einen eigenen Link ohne Login. Dort sieht sie ihre Drehaufträge und lädt die Videos hoch –
        direkt in den Google-Drive-Ordner. Die WhatsApp-Nachricht mit ihrem Wochenplan gibt es in der Wochenplanung.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {members.map((m) => {
          const link = `${base}/d/${m.token}`;
          return (
            <Glass key={m.id} className={m.active ? "space-y-3" : "space-y-3 opacity-50"}>
              <ActionForm action={saveMember} success="Gespeichert" className="grid grid-cols-2 gap-2">
                <input type="hidden" name="id" value={m.id} />
                <input name="name" defaultValue={m.name} className={inputCls} aria-label="Name" />
                <input name="area" defaultValue={m.area} list="areas" className={inputCls} aria-label="Bereich" />
                <input name="phone" defaultValue={m.phone ?? ""} placeholder="Handy (49171…)" className={inputCls} aria-label="Handy" />
                <div className="flex gap-2">
                  <input name="position" type="number" defaultValue={m.position} className={`${inputCls} w-16`} aria-label="Reihenfolge" />
                  <Button size="sm" variant="outline" className="flex-1">
                    Speichern
                  </Button>
                </div>
              </ActionForm>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <CopyButton text={link} label="Link kopieren" />
                <a href={link} target="_blank" rel="noreferrer" className="underline">
                  Ihre Seite
                </a>
                <ActionForm action={newMemberLink} confirm={`Neuen Link für ${m.name}? Der alte geht dann nicht mehr.`}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-muted-foreground underline">Neuer Link</button>
                </ActionForm>
                <ActionForm action={toggleMember}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="active" value={m.active ? "false" : "true"} />
                  <button className="text-muted-foreground underline">{m.active ? "Pausieren" : "Aktivieren"}</button>
                </ActionForm>
              </div>
            </Glass>
          );
        })}
      </div>
      <ActionForm action={saveMember} success="Hinzugefügt" reset className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="client_id" value={client.id} />
        <input name="name" placeholder="Name" className={`${inputCls} w-40`} />
        <input name="area" placeholder="Bereich" list="areas" className={`${inputCls} w-56`} />
        <input name="phone" placeholder="Handy (optional)" className={`${inputCls} w-44`} />
        <input type="hidden" name="position" value={members.length + 1} />
        <Button size="sm">+ Person</Button>
      </ActionForm>
      <AreaList />
    </div>
  );
}

export async function FormatsSection({ client }: { client: ContentClient }) {
  const { data } = await contentDb().from("content_formats").select("*").eq("client_id", client.id).order("kind").order("name");
  const formats = (data ?? []) as ContentFormat[];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Wiederkehrende Reel- und Story-Formate mit Schritt-für-Schritt-Anleitung. „Woche automatisch füllen“ verteilt sie
        reihum. Aus Research-Requests entstehen zusätzlich Einzel-Videos.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {formats.map((f) => (
          <FormatForm key={f.id} format={f} clientId={client.id} />
        ))}
        <FormatForm clientId={client.id} />
      </div>
      <AreaList />
    </div>
  );
}

function FormatForm({ format, clientId }: { format?: ContentFormat; clientId: string }) {
  return (
    <Glass className={format && !format.active ? "opacity-50" : undefined}>
      <ActionForm action={saveFormat} success="Gespeichert" reset={!format} className="space-y-2">
        <input type="hidden" name="client_id" value={clientId} />
        {format && <input type="hidden" name="id" value={format.id} />}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <input name="name" defaultValue={format?.name ?? ""} placeholder="Neues Format" className={inputCls} />
          <select name="kind" defaultValue={format?.kind ?? "reel"} className={inputCls}>
            <option value="reel">Reel</option>
            <option value="story">Story</option>
          </select>
          <select name="active" defaultValue={format?.active === false ? "false" : "true"} className={inputCls}>
            <option value="true">aktiv</option>
            <option value="false">aus</option>
          </select>
        </div>
        <input name="area" defaultValue={format?.area ?? ""} placeholder="Nur für Bereich (leer = alle)" list="areas" className={inputCls} />
        <textarea
          name="description"
          rows={2}
          defaultValue={format?.description ?? ""}
          placeholder="Worum geht es – so, wie es die Mitarbeiterin liest"
          className={inputCls}
        />
        <textarea name="shots" rows={4} defaultValue={format?.shots.join("\n") ?? ""} placeholder="Ein Schritt pro Zeile" className={inputCls} />
        <input name="tips" defaultValue={format?.tips ?? ""} placeholder="💡 Tipp" className={inputCls} />
        <input name="example_url" defaultValue={format?.example_url ?? ""} placeholder="Link zu einem Beispielvideo (optional)" className={inputCls} />
        <Button size="sm" variant="outline">
          {format ? "Speichern" : "+ Format anlegen"}
        </Button>
      </ActionForm>
      {format && (
        <ActionForm action={deleteFormat} confirm={`Format „${format.name}“ löschen?`} className="mt-2">
          <input type="hidden" name="id" value={format.id} />
          <button className="text-xs text-muted-foreground underline">Löschen</button>
        </ActionForm>
      )}
    </Glass>
  );
}
