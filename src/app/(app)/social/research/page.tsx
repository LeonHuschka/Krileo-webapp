import Link from "next/link";
import { ArrowRight, Bookmark, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/content/action-form";
import { contentDb } from "@/lib/content/db";
import { currentClient } from "@/lib/content/social";
import type { ContentInspo, ContentWatchAccount, InspoStatus } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { addInspoLink, rateNowAction, researchNow, setInspoStatus } from "../actions";
import { NoClient, PageHeader, PillTabs, fmtNum, inputCls, scoreTone } from "../shared";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TABS: { key: InspoStatus; label: string }[] = [
  { key: "neu", label: "Neu" },
  { key: "gemerkt", label: "Gemerkt" },
  { key: "request", label: "Requests" },
  { key: "verworfen", label: "Verworfen" },
];

export default async function ResearchPage({ searchParams }: { searchParams: { tab?: string } }) {
  const { client } = await currentClient();
  if (!client) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader title="Research" />
        <NoClient />
      </div>
    );
  }
  const tab = (TABS.find((t) => t.key === searchParams.tab)?.key ?? "neu") as InspoStatus;
  const db = contentDb();
  const [{ data: rows }, { data: acc }, { data: counts }] = await Promise.all([
    db
      .from("content_inspo")
      .select("*")
      .eq("client_id", client.id)
      .eq("status", tab)
      .order(tab === "neu" || tab === "gemerkt" ? "ai_score" : "created_at", { ascending: false, nullsFirst: false })
      .limit(120),
    db.from("content_watch_accounts").select("*").eq("client_id", client.id).eq("active", true),
    db.from("content_inspo").select("status, ai_at").eq("client_id", client.id),
  ]);
  const items = (rows ?? []) as ContentInspo[];
  const accounts = (acc ?? []) as ContentWatchAccount[];
  const all = (counts ?? []) as { status: InspoStatus; ai_at: string | null }[];
  const unrated = all.filter((c) => !c.ai_at).length;
  const lastRun = accounts.map((a) => a.last_scraped_at).filter(Boolean).sort().pop();
  const aiOn = !!process.env.ANTHROPIC_API_KEY;
  const apifyOn = !!(process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Research"
        subtitle={
          <>
            {accounts.length} Accounts beobachtet
            {lastRun ? ` · letzter Lauf ${new Date(lastRun).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}` : " · noch nie gescrapt"}
            {" · "}
            <Link href="/social/einstellungen?tab=research" className="underline">
              Accounts & Briefing
            </Link>
          </>
        }
      >
        <ActionForm action={researchNow} success="Research fertig">
          <input type="hidden" name="client_id" value={client.id} />
          <Button size="sm" className="bg-violet-500 text-white hover:bg-violet-400" disabled={!apifyOn || !accounts.length}>
            <Sparkles /> Jetzt scrapen
          </Button>
        </ActionForm>
        {unrated > 0 && aiOn && (
          <ActionForm action={rateNowAction} success="Bewertet">
            <input type="hidden" name="client_id" value={client.id} />
            <Button size="sm" variant="outline">
              {unrated} bewerten
            </Button>
          </ActionForm>
        )}
      </PageHeader>

      {(!apifyOn || !aiOn || !accounts.length) && (
        <div className="space-y-1 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {!accounts.length && (
            <p>
              Noch keine Accounts zum Beobachten –{" "}
              <Link href="/social/einstellungen?tab=research" className="underline">
                hier hinzufügen
              </Link>
              .
            </p>
          )}
          {!apifyOn && <p>APIFY_API_TOKEN fehlt – ohne ihn kann nicht gescrapt werden.</p>}
          {!aiOn && <p>ANTHROPIC_API_KEY fehlt – Reels werden gesammelt, aber nicht von der KI bewertet.</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillTabs
          current={tab}
          tabs={TABS.map((t) => ({
            ...t,
            href: `/social/research?tab=${t.key}`,
            count: all.filter((c) => c.status === t.key).length,
          }))}
        />
        <ActionForm action={addInspoLink} reset className="flex w-full max-w-md gap-2">
          <input type="hidden" name="client_id" value={client.id} />
          <input name="url" placeholder="Reel per Link hinzufügen: instagram.com/reel/…" className={inputCls} />
          <Button size="sm" variant="outline">
            Holen
          </Button>
        </ActionForm>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center text-sm text-white/50">
          {tab === "neu" ? "Keine neuen Reels – „Jetzt scrapen“ oder morgen früh wiederkommen." : "Hier ist noch nichts."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {items.map((r) => (
            <article key={r.id} className="glass-card flex gap-3 overflow-hidden rounded-2xl p-3">
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="relative block aspect-[9/16] w-32 shrink-0 overflow-hidden rounded-xl bg-black/40"
              >
                {(r.thumb_data ?? r.thumbnail_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumb_data ?? r.thumbnail_url!} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
                <span className={cn("absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-xs font-bold text-white", scoreTone(r.ai_score))}>
                  {r.ai_score ?? "–"}
                </span>
                {r.outlier && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold">
                    {r.outlier.toFixed(1)}×
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 pt-6 text-[10px]">
                  {fmtNum(r.views)} Views
                  <br />@{r.owner_username ?? "?"}
                </span>
              </a>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="text-sm font-semibold">{r.ai_format ?? "Noch nicht bewertet"}</div>
                {r.ai_area && <div className="text-[11px] text-violet-300">{r.ai_area}</div>}
                {r.ai_reason && <p className="mt-1 line-clamp-3 text-xs text-white/70">{r.ai_reason}</p>}
                {r.ai_idea && (
                  <p className="mt-1.5 line-clamp-3 text-xs text-white/85">
                    <span className="text-white/50">Idee: </span>
                    {r.ai_idea}
                  </p>
                )}
                {r.ai_risk && <p className="mt-1.5 line-clamp-2 rounded-md bg-rose-500/15 px-1.5 py-1 text-[11px] text-rose-200">⚠️ {r.ai_risk}</p>}
                <div className="mt-auto flex items-center gap-1 pt-2">
                  {r.status !== "request" && (
                    <>
                      <ActionForm action={setInspoStatus}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value={r.status === "gemerkt" ? "neu" : "gemerkt"} />
                        <button className={cn("rounded-full p-1.5 hover:bg-white/10", r.status === "gemerkt" && "text-amber-300")} title="Merken">
                          <Bookmark className="h-4 w-4" />
                        </button>
                      </ActionForm>
                      <ActionForm action={setInspoStatus}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value={r.status === "verworfen" ? "neu" : "verworfen"} />
                        <button className="rounded-full p-1.5 hover:bg-white/10" title={r.status === "verworfen" ? "Wiederherstellen" : "Verwerfen"}>
                          <X className="h-4 w-4" />
                        </button>
                      </ActionForm>
                    </>
                  )}
                  <Link
                    href={r.status === "request" && r.item_id ? `/social/video/${r.item_id}` : `/social/research/${r.id}`}
                    className="ml-auto flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
                  >
                    {r.status === "request" ? "Zum Video" : "Ausarbeiten"} <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
