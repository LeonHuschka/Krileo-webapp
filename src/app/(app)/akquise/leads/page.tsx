import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { LeadsTable } from "@/components/akquise/leads-table";
import { Card, CardContent } from "@/components/ui/card";
import type { Lead } from "@/lib/lead-engine/types";

export const dynamic = "force-dynamic";

export default async function AkquiseLeadsPage() {
  let leads: Lead[] = [];
  let error: string | null = null;

  try {
    const db = leadEngine();
    const { data, error: err } = await db
      .from("leads")
      .select("*")
      .order("lead_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (err) throw err;
    leads = (data ?? []) as unknown as Lead[];
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <Link
          href="/akquise"
          className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Akquise
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Leads
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Letzte 500 Leads, sortiert nach Score
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <div className="mb-2 font-medium">Lead-Engine nicht erreichbar</div>
            <code className="text-xs text-muted-foreground">{error}</code>
          </CardContent>
        </Card>
      ) : (
        <LeadsTable leads={leads} />
      )}
    </div>
  );
}
