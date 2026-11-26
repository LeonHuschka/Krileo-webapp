import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/content/action-form";
import { contentDb } from "@/lib/content/db";
import { addDays, todayIn } from "@/lib/content/time";
import type { ContentClient, ContentFormat, ContentInspo, ContentMember } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { createRequest, setInspoStatus } from "../../actions";
import { Glass, fmtNum, inputCls, scoreTone } from "../../shared";

export const dynamic = "force-dynamic";

export default async function InspoDetailPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const db = contentDb();
  const { data: inspo } = await db.from("content_inspo").select("*").eq("id", params.id).maybeSingle<ContentInspo>();
  if (!inspo) notFound();
  const [{ data: c }, { data: mem }, { data: fmts }] = await Promise.all([
    db.from("content_clients").select("*").eq("id", inspo.client_id).single<ContentClient>(),
    db.from("content_members").select("*").eq("client_id", inspo.client_id).eq("active", true).order("position"),
    db.from("content_formats").select("*").eq("client_id", inspo.client_id).eq("active", true).order("name"),
  ]);
  const client = c!;
  const members = (mem ?? []) as ContentMember[];
  const formats = (fmts ?? []) as ContentFormat[];
  const today = todayIn(client.timezone);
  const guess = members.find((m) => inspo.ai_area && m.area.toLowerCase() === inspo.ai_area.toLowerCase());
  const due = addDays(today, 3);
  const cover = inspo.thumb_data ?? inspo.thumbnail_url;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <Link href="/social/research" className="text-sm text-muted-foreground hover:text-foreground">
        ← Research
      </Link>
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <a
            href={inspo.url}
            target="_blank"
            rel="noreferrer"
            className="relative block aspect-[9/16] overflow-hidden rounded-3xl border border-white/15 bg-black/40"
          >
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="h-full w-full object-cover" />
            )}
            <span className={cn("absolute left-3 top-3 rounded-full px-2.5 py-1 text-sm font-bold text-white", scoreTone(inspo.ai_score))}>
              {inspo.ai_score ?? "–"}
            </span>
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10 text-sm">
              <ExternalLink className="h-4 w-4" /> Auf Instagram ansehen
            </span>
          </a>
          <Glass className="grid grid-cols-3 gap-2 p-3 text-center text-xs">
            <div>
              <div className="text-base font-semibold">{fmtNum(inspo.views)}</div>Views
            </div>
            <div>
              <div className="text-base font-semibold">{fmtNum(inspo.likes)}</div>Likes
            </div>
            <div>
              <div className="text-base font-semibold">{inspo.outlier ? `${inspo.outlier.toFixed(1)}×` : "–"}</div>vs. Ø
            </div>
          </Glass>
          <p className="text-xs text-white/50">
            @{inspo.owner_username ?? "?"}
            {inspo.posted_at ? ` · ${new Date(inspo.posted_at).toLocaleDateString("de-DE")}` : ""}
          </p>
          {inspo.caption && <p className="line-clamp-6 whitespace-pre-line text-xs text-white/60">{inspo.caption}</p>}
        </div>

        <div className="space-y-4">
          <Glass className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-violet-300">KI-Einordnung</div>
            <h1 className="text-xl font-semibold">{inspo.ai_format ?? "Noch nicht bewertet"}</h1>
            {inspo.ai_reason && <p className="text-sm text-white/80">{inspo.ai_reason}</p>}
            {inspo.ai_risk && <p className="rounded-lg bg-rose-500/15 p-2 text-sm text-rose-200">⚠️ {inspo.ai_risk}</p>}
            <p className="text-xs text-white/45">
              Nur Inspiration: Idee und Aufbau übernehmen, Video, Text und Musik neu machen.
            </p>
          </Glass>

          {inspo.status === "request" && inspo.item_id ? (
            <Glass>
              Schon als Request angelegt –{" "}
              <Link href={`/social/video/${inspo.item_id}`} className="underline">
                zum Video
              </Link>
              .
            </Glass>
          ) : (
            <Glass>
              <ActionForm action={createRequest} className="space-y-3">
                <input type="hidden" name="inspo_id" value={inspo.id} />
                <h2 className="text-lg font-semibold">Als Request ausarbeiten</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <L label="Wer dreht">
                    <select name="member_id" defaultValue={guess?.id ?? ""} className={inputCls}>
                      <option value="">— auswählen —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.area})
                        </option>
                      ))}
                    </select>
                  </L>
                  <L label="Art">
                    <select name="kind" defaultValue="reel" className={inputCls}>
                      <option value="reel">Reel</option>
                      <option value="story">Story</option>
                    </select>
                  </L>
                  <L label="Format (optional)">
                    <select name="format_id" defaultValue="" className={inputCls}>
                      <option value="">— eigenes —</option>
                      {formats.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </L>
                </div>
                <L label="Titel (sieht die Mitarbeiterin)">
                  <input name="title" defaultValue={inspo.ai_format ?? ""} className={inputCls} />
                </L>
                <L label="Worum geht es – deine Idee, einfach formuliert">
                  <textarea name="brief" rows={4} defaultValue={inspo.ai_idea ?? ""} className={inputCls} />
                </L>
                <L label="Das filmst du – ein Schritt pro Zeile">
                  <textarea
                    name="shots"
                    rows={5}
                    placeholder={"Handy hochkant, Licht von vorne\nErster Satz: …\nNahaufnahme Hände …\nZum Schluss lächeln"}
                    className={inputCls}
                  />
                </L>
                <L label="Hinweise für den Schnitt (VA) – eine Zeile pro Punkt">
                  <textarea name="edit_notes" rows={3} placeholder={"Hook in den ersten 2 Sekunden\nUntertitel auf Deutsch"} className={inputCls} />
                </L>
                <div className="grid gap-3 sm:grid-cols-2">
                  <L label="Drehen bis">
                    <input type="date" name="shoot_due" defaultValue={due} className={inputCls} />
                  </L>
                  <L label="Posten am">
                    <input type="date" name="publish_day" defaultValue={addDays(due, client.shoot_lead_days)} className={inputCls} />
                  </L>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="bg-violet-500 text-white hover:bg-violet-400">Als Request anlegen</Button>
                </div>
              </ActionForm>
              <ActionForm action={setInspoStatus} className="mt-2">
                <input type="hidden" name="id" value={inspo.id} />
                <input type="hidden" name="status" value="verworfen" />
                <button className="text-xs text-white/50 underline">Passt nicht – verwerfen</button>
              </ActionForm>
            </Glass>
          )}
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
