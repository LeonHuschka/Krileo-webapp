import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/content/action-form";
import { contentDb } from "@/lib/content/db";
import { isoToLocal, todayIn } from "@/lib/content/time";
import type { ContentFormat, ContentItem, ContentLead, ContentMember } from "@/lib/content/types";
import { DEFAULT_AREAS } from "@/lib/content/types";
import { addLeadAdmin, deleteLead } from "../actions";
import { NoClient, PageHeader, fmtNum, inputCls } from "../shared";
import { currentClient } from "@/lib/content/social";

export const dynamic = "force-dynamic";

type Row = { key: string; posts: number; views: number; saves: number; shares: number; leads: number; revenue: number };

function group(items: ContentItem[], leads: ContentLead[], keyItem: (i: ContentItem) => string, keyLead: (l: ContentLead) => string | null) {
  const map = new Map<string, Row>();
  const get = (k: string) => {
    if (!map.has(k)) map.set(k, { key: k, posts: 0, views: 0, saves: 0, shares: 0, leads: 0, revenue: 0 });
    return map.get(k)!;
  };
  for (const i of items) {
    const r = get(keyItem(i));
    r.posts++;
    r.views += i.metrics?.views ?? 0;
    r.saves += i.metrics?.saved ?? 0;
    r.shares += i.metrics?.shares ?? 0;
  }
  for (const l of leads) {
    const k = keyLead(l);
    if (!k) continue;
    const r = get(k);
    if (l.paying) r.leads++;
    r.revenue += Number(l.amount ?? 0);
  }
  return Array.from(map.values()).sort((a, b) => b.views - a.views);
}

const eur = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

export default async function ContentStatsPage({ searchParams }: { searchParams: { d?: string } }) {
  const { client } = await currentClient();
  if (!client) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader title="Auswertung" />
        <NoClient />
      </div>
    );
  }
  const days = [7, 30, 90].includes(Number(searchParams.d)) ? Number(searchParams.d) : 30;
  const since = new Date(Date.now() - days * 86_400_000);
  const sinceYmd = isoToLocal(since.toISOString(), client.timezone).date;
  const db = contentDb();
  const [{ data: it }, { data: ld }, { data: mem }, { data: fm }] = await Promise.all([
    db
      .from("content_items")
      .select("*")
      .eq("client_id", client.id)
      .eq("status", "veroeffentlicht")
      .gte("published_at", since.toISOString()),
    db.from("content_leads").select("*").eq("client_id", client.id).gte("lead_date", sinceYmd).order("lead_date", { ascending: false }),
    db.from("content_members").select("*").eq("client_id", client.id).order("position"),
    db.from("content_formats").select("*").eq("client_id", client.id),
  ]);
  const items = (it ?? []) as ContentItem[];
  const leads = (ld ?? []) as ContentLead[];
  const members = (mem ?? []) as ContentMember[];
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const formatName = new Map(((fm ?? []) as ContentFormat[]).map((f) => [f.id, f.name]));

  const reels = items.filter((i) => i.kind === "reel");
  const views = items.reduce((s, i) => s + (i.metrics?.views ?? 0), 0);
  const reelViews = reels.reduce((s, i) => s + (i.metrics?.views ?? 0), 0);
  const igLeads = leads.filter((l) => l.source === "instagram");
  const paying = igLeads.filter((l) => l.paying).length;
  const revenue = igLeads.reduce((s, l) => s + Number(l.amount ?? 0), 0);

  const byArea = group(items, igLeads, (i) => i.area ?? "—", (l) => l.area ?? "—");
  const byFormat = group(reels, [], (i) => formatName.get(i.format_id ?? "") ?? "ohne Format", () => null);
  const byMember = group(items, igLeads, (i) => memberName.get(i.member_id ?? "") ?? "—", (l) => memberName.get(l.member_id ?? "") ?? null);

  const mature = reels.filter((i) => i.published_at && Date.now() - Date.parse(i.published_at) > 3 * 86_400_000 && i.metrics?.views != null);
  const sorted = [...mature].sort((a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0));
  const top = sorted.slice(0, 5);
  const flop = sorted.length > 5 ? sorted.slice(-5).reverse() : [];


  return (
    <div className="space-y-8 p-4 md:p-6">
      <PageHeader title="Auswertung" subtitle={`${client.name} · was funktioniert, was bringt Kundinnen`}>
        <div className="flex gap-1 text-sm">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/social/auswertung?d=${d}`}
              className={`rounded-md px-2 py-1 ${d === days ? "bg-primary text-primary-foreground" : "border border-border"}`}
            >
              {d} Tage
            </Link>
          ))}
        </div>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {(
          [
            ["Reels", String(reels.length)],
            ["Storys", String(items.length - reels.length)],
            ["Views", fmtNum(views)],
            ["Ø Views / Reel", fmtNum(reels.length ? Math.round(reelViews / reels.length) : null)],
            ["Neue zahlende Kundinnen", String(paying)],
            ["Umsatz (eingetragen)", eur(revenue)],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xl font-semibold">{v}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
          </div>
        ))}
      </section>
      <p className="-mt-4 text-sm text-muted-foreground">
        Conversion: <strong>{views ? ((paying / views) * 10_000).toFixed(1).replace(".", ",") : "–"}</strong> zahlende Kundinnen pro
        10.000 Views · <strong>{views ? eur((revenue / views) * 1000) : "–"}</strong> Umsatz pro 1.000 Views. Gezählt wird, was das Team
        über „Neue Kundin über Instagram“ einträgt – fragt bei jeder Buchung „Wie haben Sie uns gefunden?“.
      </p>

      <Table title="Nach Bereich" rows={byArea} withLeads />
      <Table title="Nach Format (nur Reels)" rows={byFormat} />
      <Table title="Nach Person" rows={byMember} withLeads />

      <div className="grid gap-6 md:grid-cols-2">
        <ReelList title="Top 5 Reels (älter als 3 Tage)" items={top} memberName={memberName} />
        <ReelList title="Schwächste 5 Reels" items={flop} memberName={memberName} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Neue Kundinnen</h2>
        <ActionForm action={addLeadAdmin} success="Eingetragen" reset className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="date" name="lead_date" defaultValue={todayIn(client.timezone)} className={`${inputCls} w-40`} />
          <select name="member_id" className={`${inputCls} w-36`} defaultValue="">
            <option value="">Person –</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input name="area" placeholder="Bereich" list="lead-areas" className={`${inputCls} w-44`} />
          <input name="service" placeholder="Gebucht" className={`${inputCls} w-40`} />
          <input name="amount" placeholder="€" inputMode="decimal" className={`${inputCls} w-24`} />
          <select name="source" className={`${inputCls} w-36`} defaultValue="instagram">
            <option value="instagram">Instagram</option>
            <option value="sonstiges">Andere Quelle</option>
          </select>
          <Button size="sm">+ Eintragen</Button>
          <datalist id="lead-areas">
            {DEFAULT_AREAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </ActionForm>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Datum</th>
                <th className="px-3 py-2">Person</th>
                <th className="px-3 py-2">Bereich</th>
                <th className="px-3 py-2">Gebucht</th>
                <th className="px-3 py-2 text-right">€</th>
                <th className="px-3 py-2">Quelle</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                    Noch keine Einträge in diesem Zeitraum.
                  </td>
                </tr>
              )}
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-1.5">{l.lead_date.split("-").reverse().join(".")}</td>
                  <td className="px-3 py-1.5">{memberName.get(l.member_id ?? "") ?? "–"}</td>
                  <td className="px-3 py-1.5">{l.area ?? "–"}</td>
                  <td className="px-3 py-1.5">{l.service ?? "–"}</td>
                  <td className="px-3 py-1.5 text-right">{l.amount ? eur(Number(l.amount)) : "–"}</td>
                  <td className="px-3 py-1.5">{l.source}</td>
                  <td className="px-3 py-1.5 text-right">
                    <ActionForm action={deleteLead} confirm="Eintrag löschen?">
                      <input type="hidden" name="id" value={l.id} />
                      <button className="text-xs text-muted-foreground underline">löschen</button>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Table({ title, rows, withLeads }: { title: string; rows: Row[]; withLeads?: boolean }) {
  if (!rows.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2 text-right">Posts</th>
              <th className="px-3 py-2 text-right">Views</th>
              <th className="px-3 py-2 text-right">Ø Views</th>
              <th className="px-3 py-2 text-right">Gespeichert</th>
              <th className="px-3 py-2 text-right">Geteilt</th>
              {withLeads && <th className="px-3 py-2 text-right">Kundinnen</th>}
              {withLeads && <th className="px-3 py-2 text-right">Umsatz</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <td className="px-3 py-1.5 font-medium">{r.key}</td>
                <td className="px-3 py-1.5 text-right">{r.posts}</td>
                <td className="px-3 py-1.5 text-right">{fmtNum(r.views)}</td>
                <td className="px-3 py-1.5 text-right">{r.posts ? fmtNum(Math.round(r.views / r.posts)) : "–"}</td>
                <td className="px-3 py-1.5 text-right">{fmtNum(r.saves)}</td>
                <td className="px-3 py-1.5 text-right">{fmtNum(r.shares)}</td>
                {withLeads && <td className="px-3 py-1.5 text-right">{r.leads}</td>}
                {withLeads && <td className="px-3 py-1.5 text-right">{eur(r.revenue)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReelList({ title, items, memberName }: { title: string; items: ContentItem[]; memberName: Map<string, string> }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">{title}</h2>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Noch zu wenig Daten.</p>}
      <ul className="space-y-1 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between gap-2 rounded-md border border-border px-3 py-1.5">
            <Link href={`/social/video/${i.id}`} className="truncate hover:underline">
              {memberName.get(i.member_id ?? "") ?? "—"} · {i.title}
            </Link>
            <span className="shrink-0 text-muted-foreground">
              {fmtNum(i.metrics?.views)} Views · {fmtNum(i.metrics?.saved)} gesp.
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
