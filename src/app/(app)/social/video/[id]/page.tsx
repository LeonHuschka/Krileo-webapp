import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/content/action-form";
import { CaptionField } from "@/components/content/caption-field";
import { appUrl, contentDb, getItem } from "@/lib/content/db";
import { isoToLocal, todayIn } from "@/lib/content/time";
import type { ContentClient, ContentFormat, ContentInspo, ContentMember, ContentUpload } from "@/lib/content/types";
import { JobView } from "@/components/content/job-view";
import { DEFAULT_AREAS } from "@/lib/content/types";
import {
  approveItem,
  deleteItem,
  markPublished,
  publishNow,
  requestReshoot,
  retryItem,
  saveItem,
  sendBackToVa,
  unscheduleItem,
} from "../../actions";
import { fmtNum, inputCls } from "../../shared";

export const dynamic = "force-dynamic";

function fmt(iso: string | null, tz: string) {
  if (!iso) return null;
  const { date, time } = isoToLocal(iso, tz);
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y} ${time}`;
}

export default async function ContentItemPage({ params }: { params: { id: string } }) {
  const item = await getItem(params.id);
  if (!item) notFound();
  const db = contentDb();
  const [{ data: c }, { data: mem }, { data: fmts }, { data: ups }] = await Promise.all([
    db.from("content_clients").select("*").eq("id", item.client_id).single<ContentClient>(),
    db.from("content_members").select("*").eq("client_id", item.client_id).order("position"),
    db.from("content_formats").select("*").eq("client_id", item.client_id).order("name"),
    db.from("content_uploads").select("*").eq("item_id", item.id).order("created_at"),
  ]);
  const client = c!;
  const tz = client.timezone;
  const members = (mem ?? []) as ContentMember[];
  const formats = (fmts ?? []) as ContentFormat[];
  const uploads = (ups ?? []) as ContentUpload[];
  const member = members.find((m) => m.id === item.member_id);
  const local = item.publish_at ? isoToLocal(item.publish_at, tz) : null;
  const { data: inspo } = item.inspo_id
    ? await db.from("content_inspo").select("*").eq("id", item.inspo_id).maybeSingle<ContentInspo>()
    : { data: null };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/social/editing" className="hover:text-foreground">
          ← Editing
        </Link>
        <span>·</span>
        <Link href="/social/planung" className="hover:text-foreground">
          Wochenplanung
        </Link>
        {item.ig_permalink && (
          <>
            <span>·</span>
            <a href={item.ig_permalink} target="_blank" rel="noreferrer" className="underline">
              Auf Instagram ansehen
            </a>
          </>
        )}
      </div>

      <JobView client={client} item={item} member={member ?? null} inspo={inspo ?? null} uploads={uploads} token={client.va_token} lang="de" />

      <h2 className="pt-2 text-lg font-semibold">Planung, Caption & Freigabe</h2>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ── Brief & caption ─────────────────────────────────────── */}
        <ActionForm action={saveItem} success="Gespeichert" className="space-y-4">
          <input type="hidden" name="id" value={item.id} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Wer dreht">
              <select name="member_id" defaultValue={item.member_id ?? ""} className={inputCls}>
                <option value="">— niemand —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.area}){m.active ? "" : " – inaktiv"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Format">
              <select name="format_id" defaultValue={item.format_id ?? ""} className={inputCls}>
                <option value="">— frei —</option>
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.kind === "story" ? "Story" : "Reel"})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Art">
              <select name="kind" defaultValue={item.kind} className={inputCls}>
                <option value="reel">Reel</option>
                <option value="story">Story</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Titel (sieht die Mitarbeiterin)">
              <input name="title" defaultValue={item.title} className={inputCls} />
            </Field>
            <Field label="Bereich">
              <input name="area" defaultValue={item.area ?? ""} list="content-areas" className={inputCls} />
              <datalist id="content-areas">
                {DEFAULT_AREAS.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field label="Worum geht es (einfach formulieren)">
            <textarea name="brief" rows={3} defaultValue={item.brief ?? ""} className={inputCls} />
          </Field>
          <Field label="Das filmst du – ein Schritt pro Zeile">
            <textarea name="shots" rows={6} defaultValue={item.shots.join("\n")} className={inputCls} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Drehen bis">
              <input type="date" name="shoot_due" defaultValue={item.shoot_due ?? ""} className={inputCls} />
            </Field>
            <Field label="Posten am">
              <input type="date" name="publish_day" defaultValue={local?.date ?? ""} className={inputCls} />
            </Field>
            <Field label="Uhrzeit">
              <input
                type="time"
                name="publish_time"
                defaultValue={local?.time ?? (item.kind === "story" ? client.story_time : client.reel_time)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label={item.kind === "story" ? "Caption (bei Storys nicht sichtbar – optional)" : "Caption"}>
            <CaptionField defaultValue={item.caption ?? ""} area={item.area} className={inputCls} />
          </Field>
          <Button type="submit">Speichern</Button>
        </ActionForm>

        {/* ── Status, files, approval ─────────────────────────────── */}
        <aside className="space-y-4">
          <Box title="Ablauf">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Gedreht</dt>
              <dd>{fmt(item.shot_at, tz) ?? "–"}</dd>
              <dt className="text-muted-foreground">Geschnitten</dt>
              <dd>{fmt(item.cut_at, tz) ?? "–"}</dd>
              <dt className="text-muted-foreground">Freigegeben</dt>
              <dd>{fmt(item.approved_at, tz) ?? "–"}</dd>
              <dt className="text-muted-foreground">Online</dt>
              <dd>{fmt(item.published_at, tz) ?? "–"}</dd>
            </dl>
            {member && (
              <p className="mt-2 text-xs">
                <a href={`${appUrl()}/d/${member.token}`} target="_blank" rel="noreferrer" className="underline">
                  Seite von {member.name} öffnen
                </a>
              </p>
            )}
            {item.note_member && <p className="mt-2 text-xs text-amber-300">Hinweis an {member?.name}: {item.note_member}</p>}
            {item.note_va && <p className="mt-1 text-xs text-amber-300">Hinweis an VA: {item.note_va}</p>}
            {item.publish_error && <p className="mt-2 text-xs text-red-400">Fehler: {item.publish_error}</p>}
          </Box>

          {item.status === "freigabe" && (
            <Box title="Freigabe">
              <ActionForm action={approveItem} success="Freigegeben und eingeplant" className="space-y-2">
                <input type="hidden" name="id" value={item.id} />
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" name="legal_ok" className="mt-0.5" />
                  Video und Caption geprüft: keine Heil- oder Wirkversprechen, Pflichthinweis drin, Einwilligung der
                  Personen im Bild liegt vor.
                </label>
                <Button type="submit" size="sm" className="w-full">
                  Freigeben & einplanen ({local ? `${local.date.split("-").reverse().join(".")} ${local.time}` : "ohne Datum"})
                </Button>
                <p className="text-[11px] text-muted-foreground">Erst Caption und Datum speichern, dann freigeben.</p>
              </ActionForm>
              <NoteForm action={sendBackToVa} id={item.id} label="Zurück an den Schnitt" placeholder="Was soll die VA ändern?" />
            </Box>
          )}

          {["gedreht", "freigabe"].includes(item.status) && (
            <Box title="Nachdreh">
              <NoteForm
                action={requestReshoot}
                id={item.id}
                label={`Nachdreh bei ${member?.name ?? "Mitarbeiterin"} anfordern`}
                placeholder="Was soll nochmal gedreht werden?"
                withDate
              />
            </Box>
          )}

          {item.status === "eingeplant" && (
            <Box title="Eingeplant">
              <p className="text-xs text-muted-foreground">
                Geht automatisch raus: {fmt(item.publish_at, tz)}
                {item.publish_state ? ` · Stand: ${item.publish_state}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <ActionForm action={publishNow} success="Wird gepostet" confirm="Jetzt sofort auf Instagram posten?">
                  <input type="hidden" name="id" value={item.id} />
                  <Button size="sm">Jetzt posten</Button>
                </ActionForm>
                <ActionForm action={unscheduleItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button size="sm" variant="outline">
                    Zurückziehen
                  </Button>
                </ActionForm>
              </div>
            </Box>
          )}

          {item.status === "fehler" && (
            <Box title="Posten fehlgeschlagen">
              <div className="flex flex-wrap gap-2">
                <ActionForm action={retryItem} success="Wird erneut versucht">
                  <input type="hidden" name="id" value={item.id} />
                  <Button size="sm">Nochmal versuchen</Button>
                </ActionForm>
                <ActionForm action={unscheduleItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button size="sm" variant="outline">
                    Zur Freigabe
                  </Button>
                </ActionForm>
              </div>
              <ActionForm action={markPublished} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={item.id} />
                <input name="permalink" placeholder="Instagram-Link, falls von Hand gepostet" className={inputCls} />
                <Button size="sm" variant="outline">
                  Als gepostet markieren
                </Button>
              </ActionForm>
            </Box>
          )}

          {item.metrics && (
            <Box title="Zahlen">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {(
                  [
                    ["Views", item.metrics.views],
                    ["Reichweite", item.metrics.reach],
                    ["Likes", item.metrics.likes],
                    ["Kommentare", item.metrics.comments],
                    ["Geteilt", item.metrics.shares],
                    ["Gespeichert", item.metrics.saved],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l} className="rounded-md bg-muted/40 p-2">
                    <div className="text-base font-semibold">{fmtNum(v)}</div>
                    <div className="text-muted-foreground">{l}</div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Stand {fmt(item.metrics_at, tz)}</p>
            </Box>
          )}

          {item.status !== "veroeffentlicht" && (
            <ActionForm action={deleteItem} confirm="Dieses Video wirklich löschen? Die Dateien in Drive bleiben.">
              <input type="hidden" name="id" value={item.id} />
              <Button size="sm" variant="ghost" className="text-red-400">
                Video löschen
              </Button>
            </ActionForm>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function NoteForm({
  action,
  id,
  label,
  placeholder,
  withDate,
}: {
  action: (fd: FormData) => Promise<{ error?: string }>;
  id: string;
  label: string;
  placeholder: string;
  withDate?: boolean;
}) {
  return (
    <ActionForm action={action} success="Erledigt" className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <textarea name="note" rows={2} placeholder={placeholder} className={inputCls} />
      {withDate && (
        <input type="date" name="shoot_due" defaultValue={todayIn()} className={inputCls} aria-label="Neu drehen bis" />
      )}
      <Button size="sm" variant="outline" className="w-full">
        {label}
      </Button>
    </ActionForm>
  );
}
