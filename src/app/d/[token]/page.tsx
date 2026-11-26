import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Jost, Marcellus } from "next/font/google";
import { contentDb, memberByToken } from "@/lib/content/db";
import { dayLong, isoToLocal, relativeDay, daysUntil } from "@/lib/content/time";
import { UploadButton } from "@/components/content/upload-button";
import { LeadButton } from "@/components/content/lead-button";
import type { ContentFormat, ContentItem } from "@/lib/content/types";

/**
 * The team member's page: one link, no login, nothing to learn.
 * Shows what to film and by when, takes the videos, and has one button
 * for "a new customer came through Instagram".
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meine Videos", robots: { index: false, follow: false } };

const marcellus = Marcellus({ subsets: ["latin"], weight: "400", variable: "--font-head" });
const jost = Jost({ subsets: ["latin"], variable: "--font-body" });

const SHOOT_TIPS = [
  "Handy immer hochkant halten",
  "Licht von vorne – am besten zum Fenster schauen",
  "Kamera-Linse kurz am Shirt abwischen",
  "Handy ruhig halten oder irgendwo anlehnen",
  "Lieber ein paar Sekunden länger filmen – schneiden macht die Cutterin",
  "Nicht zoomen, lieber näher rangehen",
  "Kundinnen nur filmen, wenn sie vorher Ja gesagt haben",
];

export default async function MemberPage({ params }: { params: { token: string } }) {
  const access = await memberByToken(params.token);
  if (!access) notFound();
  const { member, client } = access;
  const tz = client.timezone;
  const db = contentDb();

  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data: rows } = await db
    .from("content_items")
    .select("*")
    .eq("member_id", member.id)
    .or(`status.eq.geplant,updated_at.gte.${since}`)
    .order("shoot_due", { ascending: true, nullsFirst: false });
  const items = (rows ?? []) as ContentItem[];
  const formatIds = Array.from(new Set(items.map((i) => i.format_id).filter(Boolean))) as string[];
  const { data: fRows } = formatIds.length
    ? await db.from("content_formats").select("*").in("id", formatIds)
    : { data: [] };
  const formats = new Map(((fRows ?? []) as ContentFormat[]).map((f) => [f.id, f]));

  const todo = items.filter((i) => i.status === "geplant");
  const done = items.filter((i) => i.status !== "geplant").slice(0, 8);
  const wa = client.coordinator_phone?.replace(/[^\d]/g, "");

  return (
    <div
      className={`${marcellus.variable} ${jost.variable} min-h-screen bg-[#F7E5C5] text-[#1f2d27]`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <header className="bg-[#2F4A3F] px-5 pb-8 pt-10 text-[#F7E5C5]">
        <div className="mx-auto max-w-xl">
          <p className="text-sm uppercase tracking-[0.2em] text-[#C99A45]">{client.name}</p>
          <h1 className="mt-2 text-4xl" style={{ fontFamily: "var(--font-head)" }}>
            Hallo {member.name} 🌿
          </h1>
          <p className="mt-3 text-lg opacity-90">
            {todo.length === 0
              ? "Gerade ist nichts zu drehen. Danke dir!"
              : todo.length === 1
                ? "Du hast 1 Video zu drehen."
                : `Du hast ${todo.length} Videos zu drehen.`}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-6 text-lg">
        <details className="rounded-2xl bg-white/60 p-5">
          <summary className="cursor-pointer text-lg font-medium">📱 So filmst du richtig (kurz lesen)</summary>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            {SHOOT_TIPS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </details>

        {todo.map((item) => {
          const f = item.format_id ? formats.get(item.format_id) : undefined;
          const late = item.shoot_due ? daysUntil(item.shoot_due, tz) < 0 : false;
          return (
            <section key={item.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className={`px-5 py-3 text-base font-medium ${late ? "bg-[#873A39] text-white" : "bg-[#C99A45]/20"}`}>
                {item.kind === "story" ? "📸 Story" : "🎬 Reel"}
                {item.shoot_due ? (
                  <>
                    {" · bis "}
                    {dayLong(item.shoot_due)} ({relativeDay(item.shoot_due, tz)})
                  </>
                ) : null}
              </div>
              <div className="space-y-4 p-5">
                <h2 className="text-2xl" style={{ fontFamily: "var(--font-head)" }}>
                  {item.title}
                </h2>
                {item.note_member && (
                  <p className="rounded-xl border-l-4 border-[#C47465] bg-[#C47465]/10 p-3">
                    <strong>Hinweis von Leon:</strong> {item.note_member}
                  </p>
                )}
                {item.brief && (
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wider text-[#2F4A3F]/70">Worum geht es</p>
                    <p className="whitespace-pre-line">{item.brief}</p>
                  </div>
                )}
                {item.shots.length > 0 && (
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wider text-[#2F4A3F]/70">
                      Das filmst du – Schritt für Schritt
                    </p>
                    <ol className="mt-2 space-y-2">
                      {item.shots.map((s, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2F4A3F] text-base text-[#F7E5C5]">
                            {i + 1}
                          </span>
                          <span className="pt-0.5">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {f?.tips && <p className="rounded-xl bg-[#F7E5C5]/60 p-3">💡 {f.tips}</p>}
                {f?.example_url && (
                  <a href={f.example_url} target="_blank" rel="noreferrer" className="block font-medium text-[#2F4A3F] underline">
                    ▶️ Beispiel ansehen
                  </a>
                )}
                <UploadButton role="member" token={params.token} itemId={item.id} />
                <p className="text-center text-sm opacity-60">Du kannst mehrere Videos auf einmal auswählen.</p>
              </div>
            </section>
          );
        })}

        <LeadButton token={params.token} />

        {done.length > 0 && (
          <section className="rounded-3xl bg-white/50 p-5">
            <h2 className="text-xl" style={{ fontFamily: "var(--font-head)" }}>
              Schon erledigt
            </h2>
            <ul className="mt-3 space-y-3">
              {done.map((item) => (
                <li key={item.id} className="border-b border-black/5 pb-3 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <span>
                      {item.kind === "story" ? "📸" : "🎬"} {item.title}
                    </span>
                    <span className="shrink-0 text-base">
                      {item.status === "veroeffentlicht" && item.ig_permalink ? (
                        <a href={item.ig_permalink} target="_blank" rel="noreferrer" className="text-[#2F4A3F] underline">
                          Online 🎉
                        </a>
                      ) : item.status === "veroeffentlicht" ? (
                        "Online 🎉"
                      ) : item.status === "gedreht" ? (
                        "✓ beim Schnitt"
                      ) : item.status === "fehler" ? (
                        "Leon kümmert sich"
                      ) : (
                        `✓ fertig${item.publish_at ? ` · ${dayLong(isoToLocal(item.publish_at, tz).date)}` : ""}`
                      )}
                    </span>
                  </div>
                  {item.status === "gedreht" && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-base text-[#2F4A3F]/80">Noch ein Video nachreichen</summary>
                      <UploadButton role="member" token={params.token} itemId={item.id} className="mt-3" />
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            className="block text-center text-base text-[#2F4A3F] underline"
            target="_blank"
            rel="noreferrer"
          >
            Fragen? Schreib Leon auf WhatsApp
          </a>
        )}
        <p className="pb-6 text-center text-sm opacity-50">
          Tipp: Diese Seite auf dem Handy zum Home-Bildschirm hinzufügen.
        </p>
      </main>
    </div>
  );
}
