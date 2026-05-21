import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const PIPELINE_STAGES = [
  { key: "scrape", label: "Scrape", status: "live" },
  { key: "enrich", label: "Enrichment", status: "todo" },
  { key: "score", label: "Scoring", status: "todo" },
  { key: "route", label: "Channel-Routing", status: "todo" },
  { key: "email", label: "Email-Gen", status: "todo" },
  { key: "smartlead", label: "Smartlead Push", status: "todo" },
  { key: "reply", label: "Reply-Handler", status: "todo" },
] as const;

export default function AkquisePage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Akquise
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cold-Outreach-Pipeline für lokale SMBs (DACH). Eigene Supabase-DB,
          getrennt von Aufträgen/Kontakten.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline-Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PIPELINE_STAGES.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between rounded-md border border-border/50 bg-card px-3 py-2 text-sm"
            >
              <span>{s.label}</span>
              <Badge
                variant="outline"
                className={
                  s.status === "live"
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-zinc-500/40 bg-zinc-500/15 text-zinc-300"
                }
              >
                {s.status === "live" ? "Live" : "Todo"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasks-Queue, Leads-Browser & Campaign-KPIs</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Kommt in der nächsten Iteration (P3 aus dem Handoff). Stage 1
          (Scrape) ist via{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            POST /api/lead-engine/scrape
          </code>{" "}
          und{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            GET /api/cron/weekly-scrape
          </code>{" "}
          ansprechbar.
        </CardContent>
      </Card>
    </div>
  );
}
