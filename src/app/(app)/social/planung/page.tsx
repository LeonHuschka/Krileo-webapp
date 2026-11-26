import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageCircle, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/content/action-form";
import { appUrl, contentDb } from "@/lib/content/db";
import { currentClient } from "@/lib/content/social";
import { addDays, dayLong, dayShort, isoToLocal, isoWeek, mondayOf, todayIn } from "@/lib/content/time";
import type { ContentFormat, ContentItem, ContentKind, ContentMember } from "@/lib/content/types";
import { KIND_LABEL } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { autofillAction, createItem } from "../actions";
import { Glass, NoClient, PageHeader, PillTabs, STATUS_DOT, StatusBadge } from "../shared";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default async function PlanungPage({ searchParams }: { searchParams: { w?: string; view?: string; p?: string } }) {
  const { client } = await currentClient();
  if (!client) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader title="Wochenplanung" />
        <NoClient />
      </div>
    );
  }
  const tz = client.timezone;
  const today = todayIn(tz);
  const monday = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.w ?? "") ? mondayOf(searchParams.w!) : mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const sunday = days[6];
  const view = searchParams.view === "posting" ? "posting" : "team";

  const db = contentDb();
  const [{ data: mem }, { data: fmts }, { data: rows }] = await Promise.all([
    db.from("content_members").select("*").eq("client_id", client.id).eq("active", true).order("position"),
    db.from("content_formats").select("*").eq("client_id", client.id),
    db
      .from("content_items")
      .select("*")
      .eq("client_id", client.id)
      .or(
        `and(shoot_due.gte.${addDays(monday, -7)},shoot_due.lte.${addDays(sunday, 7)}),and(publish_at.gte.${addDays(monday, -1)},publish_at.lte.${addDays(sunday, 2)})`,
      ),
  ]);
  const members = (mem ?? []) as ContentMember[];
  const formats = new Map(((fmts ?? []) as ContentFormat[]).map((f) => [f.id, f]));
  const items = (rows ?? []) as ContentItem[];
  const pubDay = (i: ContentItem) => (i.publish_at ? isoToLocal(i.publish_at, tz).date : null);
  const person = members.find((m) => m.id === searchParams.p) ?? null;

  const weekItems = items.filter((i) => {
    const s = i.shoot_due;
    const p = pubDay(i);
    return (s && s >= monday && s <= sunday) || (p && p >= monday && p <= sunday);
  });
  const reels = weekItems.filter((i) => i.kind === "reel" && pubDay(i) && pubDay(i)! >= monday && pubDay(i)! <= sunday).length;
  const stories = weekItems.filter((i) => i.kind === "story" && pubDay(i) && pubDay(i)! >= monday && pubDay(i)! <= sunday).length;

  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { w: monday, view, p: searchParams.p, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/social/planung?${p}`;
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Wochenplanung"
        subtitle={
          <>
            KW {isoWeek(monday)} · {dayShort(monday)} – {dayShort(sunday)} · <strong>{reels}/7</strong> Reels ·{" "}
            <strong>{stories}/7</strong> Storys eingeplant
          </>
        }
      >
        <div className="flex items-center gap-1">
          <Link href={q({ w: addDays(monday, -7) })}>
            <Button variant="outline" size="icon" aria-label="Woche zurück">
              <ChevronLeft />
            </Button>
          </Link>
          <Link href={q({ w: mondayOf(today) })}>
            <Button variant="outline" size="sm">
              Diese Woche
            </Button>
          </Link>
          <Link href={q({ w: addDays(monday, 7) })}>
            <Button variant="outline" size="icon" aria-label="Woche vor">
              <ChevronRight />
            </Button>
          </Link>
        </div>
        <ActionForm action={autofillAction} success="Freie Plätze gefüllt">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="days" value="7" />
          <input type="hidden" name="start" value={monday < today ? today : monday} />
          <Button size="sm" className="bg-violet-500 text-white hover:bg-violet-400">
            Woche automatisch füllen
          </Button>
        </ActionForm>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <PillTabs
          current={person ? "" : view}
          tabs={[
            { key: "team", label: "Team-Kalender", href: q({ view: "team", p: undefined }) },
            { key: "posting", label: "Posting-Plan", href: q({ view: "posting", p: undefined }) },
          ]}
        />
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <Link
              key={m.id}
              href={q({ p: m.id })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                person?.id === m.id ? "border-violet-400 bg-violet-500/20 text-white" : "border-white/10 text-muted-foreground hover:text-foreground",
              )}
            >
              {m.name}
            </Link>
          ))}
        </div>
      </div>

      {person ? (
        <PersonView
          person={person}
          items={items.filter((i) => i.member_id === person.id)}
          formats={formats}
          tz={tz}
          today={today}
          monday={monday}
          sunday={sunday}
          clientId={client.id}
        />
      ) : view === "team" ? (
        <Glass className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] table-fixed text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-36 px-3 py-3 font-medium">Drehen bis →</th>
                {days.map((d, i) => (
                  <th key={d} className={cn("px-2 py-3 font-medium", d === today && "text-violet-300")}>
                    {WEEKDAYS[i]} {d.slice(8)}.{d.slice(5, 7)}.
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-white/5 align-top">
                  <td className="px-3 py-3">
                    <Link href={q({ p: m.id })} className="font-medium hover:underline">
                      {m.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{m.area}</div>
                  </td>
                  {days.map((d) => {
                    const list = items.filter((i) => i.member_id === m.id && i.shoot_due === d);
                    return (
                      <td key={d} className={cn("group px-1.5 py-2", d === today && "bg-violet-500/[0.06]")}>
                        <div className="space-y-1">
                          {list.map((i) => (
                            <Chip key={i.id} item={i} tz={tz} showPublish />
                          ))}
                          <ActionForm action={createItem}>
                            <input type="hidden" name="client_id" value={client.id} />
                            <input type="hidden" name="member_id" value={m.id} />
                            <input type="hidden" name="shoot_due" value={d} />
                            <input type="hidden" name="day" value={addDays(d, client.shoot_lead_days)} />
                            <input type="hidden" name="kind" value="reel" />
                            <button className="flex w-full items-center justify-center rounded-md border border-dashed border-white/10 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:border-violet-400/50 hover:text-violet-300 group-hover:opacity-100">
                              <Plus className="h-3 w-3" />
                            </button>
                          </ActionForm>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-white/5 px-3 py-2 text-xs text-muted-foreground">
            Jede Karte steht am Tag, an dem das Video gedreht und hochgeladen sein muss. Darunter: wann es gepostet wird.
          </p>
        </Glass>
      ) : (
        <Glass className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] table-fixed text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-28 px-3 py-3 font-medium">Posten am →</th>
                {days.map((d, i) => (
                  <th key={d} className={cn("px-2 py-3 font-medium", d === today && "text-violet-300")}>
                    {WEEKDAYS[i]} {d.slice(8)}.{d.slice(5, 7)}.
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["reel", "story"] as ContentKind[]).map((kind) => (
                <tr key={kind} className="border-t border-white/5 align-top">
                  <td className="px-3 py-3 font-medium">
                    {KIND_LABEL[kind]}
                    <div className="text-xs font-normal text-muted-foreground">
                      {kind === "reel" ? client.reel_time : client.story_time} Uhr
                    </div>
                  </td>
                  {days.map((d) => {
                    const list = items.filter((i) => i.kind === kind && pubDay(i) === d);
                    return (
                      <td key={d} className={cn("px-1.5 py-2", d === today && "bg-violet-500/[0.06]")}>
                        <div className="space-y-1">
                          {list.map((i) => (
                            <Chip key={i.id} item={i} tz={tz} member={members.find((m) => m.id === i.member_id)} />
                          ))}
                          {list.length === 0 && (
                            <ActionForm action={createItem}>
                              <input type="hidden" name="client_id" value={client.id} />
                              <input type="hidden" name="day" value={d} />
                              <input type="hidden" name="kind" value={kind} />
                              <button className="w-full rounded-md border border-dashed border-red-400/30 py-2 text-xs text-red-300/80 hover:bg-red-500/5">
                                frei · planen
                              </button>
                            </ActionForm>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Glass>
      )}
    </div>
  );
}

function Chip({
  item,
  tz,
  member,
  showPublish,
}: {
  item: ContentItem;
  tz: string;
  member?: ContentMember;
  showPublish?: boolean;
}) {
  const pub = item.publish_at ? isoToLocal(item.publish_at, tz) : null;
  return (
    <Link
      href={`/social/video/${item.id}`}
      className="block rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 transition-colors hover:border-violet-400/40 hover:bg-violet-500/10"
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[item.status])} />
        <span className="truncate text-xs font-medium">
          {item.kind === "story" ? "📸" : "🎬"} {member ? `${member.name} · ` : ""}
          {item.title}
        </span>
      </div>
      {showPublish && pub && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          postet {dayShort(pub.date)} {pub.time}
        </div>
      )}
    </Link>
  );
}

function PersonView({
  person,
  items,
  formats,
  tz,
  today,
  monday,
  sunday,
  clientId,
}: {
  person: ContentMember;
  items: ContentItem[];
  formats: Map<string, ContentFormat>;
  tz: string;
  today: string;
  monday: string;
  sunday: string;
  clientId: string;
}) {
  const sorted = [...items].sort((a, b) => (a.shoot_due ?? "9").localeCompare(b.shoot_due ?? "9"));
  const open = sorted.filter((i) => i.status === "geplant");
  const link = `${appUrl()}/d/${person.token}`;
  const lines = open
    .filter((i) => !i.shoot_due || i.shoot_due <= addDays(sunday, 7))
    .map((i) => `• ${i.title}${i.shoot_due ? ` – bis ${dayLong(i.shoot_due)}` : ""}`);
  const text = [
    `Hallo ${person.name} 🌿`,
    lines.length ? `diese Woche hast du ${lines.length === 1 ? "1 Video" : `${lines.length} Videos`} zu drehen:` : "gerade ist nichts zu drehen – danke dir!",
    ...lines,
    "",
    "Hier steht genau, was du filmen sollst, und da lädst du die Videos auch hoch:",
    link,
    "",
    "Danke dir! 💚",
  ].join("\n");
  const wa = `https://wa.me/${person.phone?.replace(/[^\d]/g, "") ?? ""}?text=${encodeURIComponent(text)}`;

  return (
    <div className="space-y-4">
      <Glass className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{person.name}</div>
          <div className="text-sm text-muted-foreground">
            {person.area} · {open.length} offen · {sorted.filter((i) => i.status !== "geplant").length} erledigt
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={wa} target="_blank" rel="noreferrer">
            <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500">
              <MessageCircle /> WhatsApp mit Wochenplan
            </Button>
          </a>
          <a href={link} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink /> Ihre Seite ansehen
            </Button>
          </a>
          <ActionForm action={createItem}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="member_id" value={person.id} />
            <input type="hidden" name="day" value={addDays(monday < today ? today : monday, 3)} />
            <input type="hidden" name="kind" value="reel" />
            <Button size="sm" variant="outline">
              <Plus /> Video für {person.name}
            </Button>
          </ActionForm>
        </div>
      </Glass>

      <Glass className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-medium">Video</th>
              <th className="px-3 py-3 font-medium">Was filmen</th>
              <th className="px-3 py-3 font-medium">Drehen bis</th>
              <th className="px-3 py-3 font-medium">Posten am</th>
              <th className="px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  In diesem Zeitraum nichts geplant.
                </td>
              </tr>
            )}
            {sorted.map((i) => {
              const pub = i.publish_at ? isoToLocal(i.publish_at, tz) : null;
              const late = i.status === "geplant" && i.shoot_due && i.shoot_due < today;
              return (
                <tr key={i.id} className="border-t border-white/5 align-top">
                  <td className="px-3 py-3">
                    <Link href={`/social/video/${i.id}`} className="font-medium hover:underline">
                      {i.kind === "story" ? "📸" : "🎬"} {i.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {formats.get(i.format_id ?? "")?.name ?? "freies Format"} · {i.area ?? "—"}
                    </div>
                  </td>
                  <td className="max-w-[360px] px-3 py-3 text-xs text-muted-foreground">
                    {i.shots.length ? (
                      <ol className="list-decimal space-y-0.5 pl-4">
                        {i.shots.slice(0, 5).map((s, n) => (
                          <li key={n}>{s}</li>
                        ))}
                      </ol>
                    ) : (
                      i.brief ?? "–"
                    )}
                  </td>
                  <td className={cn("px-3 py-3 whitespace-nowrap", late && "font-medium text-red-400")}>
                    {i.shoot_due ? dayShort(i.shoot_due) : "–"}
                    {late && <div className="text-[10px]">überfällig</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{pub ? `${dayShort(pub.date)} ${pub.time}` : "–"}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={i.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}
