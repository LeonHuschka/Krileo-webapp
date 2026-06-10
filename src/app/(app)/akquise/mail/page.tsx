import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColdMailBoard } from "@/components/akquise/cold-mail-board";
import {
  getCampaignNicheMap,
  getCampaignsWithStats,
  getConnectionStatus,
  getEmailPool,
  getReplies,
} from "@/lib/smartlead/service";
import { formatLeadEngineError } from "@/lib/lead-engine/format-error";

export const dynamic = "force-dynamic";

export type PoolLead = {
  id: string;
  business_name: string;
  owner_name: string | null;
  owner_email: string | null;
  city: string | null;
  lead_score: number | null;
  fit_offer: string | null;
  category: string | null;
  /** Niche derived from the lead's source campaign — the grouping we
   *  push by, so only matching leads enter a niche campaign. */
  niche: string | null;
};

export type ReplyLead = {
  id: string;
  business_name: string;
  owner_name: string | null;
  owner_email: string | null;
  city: string | null;
  smartlead_last_reply_at: string | null;
  smartlead_last_reply_text: string | null;
};

export default async function ColdMailPage() {
  const connection = await getConnectionStatus();

  let campaigns = [] as Awaited<ReturnType<typeof getCampaignsWithStats>>["campaigns"];
  let campaignError: string | null = null;
  let poolLeads: PoolLead[] = [];
  let replies: ReplyLead[] = [];
  let allNiches: string[] = [];
  let dbError: string | null = null;

  try {
    const res = await getCampaignsWithStats();
    campaigns = res.campaigns;
    campaignError = res.error;
  } catch (err) {
    campaignError = err instanceof Error ? err.message : String(err);
  }

  try {
    const [pool, reps, nicheMap] = await Promise.all([
      getEmailPool(500),
      getReplies(50),
      getCampaignNicheMap(),
    ]);
    // Full niche universe (all scrape industries) — so an already-emptied
    // niche like copy_shops can still be assigned to its campaign.
    allNiches = Array.from(
      new Set(
        Object.values(nicheMap)
          .map((c) => c.industry?.trim())
          .filter((x): x is string => !!x && x !== "d2d"),
      ),
    ).sort();
    poolLeads = pool.map((l) => {
      const camp = nicheMap[l.campaign_id];
      const niche = camp?.industry?.trim() || l.category?.trim() || null;
      return {
        id: l.id,
        business_name: l.business_name,
        owner_name: l.owner_name,
        owner_email: l.owner_email,
        city: l.city,
        lead_score: l.lead_score,
        fit_offer: l.fit_offer,
        category: l.category,
        niche,
      };
    });
    replies = reps.map((l) => ({
      id: l.id,
      business_name: l.business_name,
      owner_name: l.owner_name,
      owner_email: l.owner_email,
      city: l.city,
      smartlead_last_reply_at: l.smartlead_last_reply_at,
      smartlead_last_reply_text: l.smartlead_last_reply_text,
    }));
  } catch (err) {
    dbError = formatLeadEngineError(err);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/akquise"
            className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Akquise
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <Mail className="h-6 w-6 text-primary" />
            Cold Mail
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Leads in Smartlead-Kampagnen pushen. Sequenz + Texte schreibst
            du in Smartlead — jeder Lead bringt seine Personalisierung als
            Merge-Variablen mit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href="https://app.smartlead.ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> Smartlead öffnen
            </Button>
          </a>
          {connection.configured ? (
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
            >
              Smartlead verbunden
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/15 text-amber-300"
            >
              API-Key fehlt
            </Badge>
          )}
          {connection.configured && (
            <Badge variant="outline" className="border-border/60">
              {connection.mailboxes} Postfächer · {connection.dailyCapacity}/Tag
            </Badge>
          )}
        </div>
      </div>

      {!connection.configured && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="font-medium text-amber-300">
              Smartlead noch nicht verbunden
            </div>
            <p className="text-muted-foreground">
              Setze <code>SMARTLEAD_API_KEY</code> in <code>.env.local</code>{" "}
              (lokal) und in den Vercel-Env-Variablen. Danach Seite neu laden.
            </p>
          </CardContent>
        </Card>
      )}

      {connection.error && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="font-medium text-rose-300">
              Smartlead-API nicht erreichbar
            </div>
            <code className="block whitespace-pre-wrap text-xs">
              {connection.error}
            </code>
          </CardContent>
        </Card>
      )}

      {(campaignError || dbError) && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="font-medium text-rose-300">Fehler</div>
            {campaignError && (
              <code className="block whitespace-pre-wrap text-xs">
                {campaignError}
              </code>
            )}
            {dbError && (
              <code className="block whitespace-pre-wrap text-xs">
                {dbError} — evtl. Migration{" "}
                <code>00026_smartlead.sql</code> noch nicht applied.
              </code>
            )}
          </CardContent>
        </Card>
      )}

      <ColdMailBoard
        configured={connection.configured}
        campaigns={campaigns}
        poolLeads={poolLeads}
        replies={replies}
        allNiches={allNiches}
      />
    </div>
  );
}
