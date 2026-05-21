import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import type { Channel, Industry, Lead } from "@/lib/lead-engine/types";

// Per-industry channel preference (best-fit first).
const PREFS: Record<Industry, Channel[]> = {
  aerzte: ["email", "call"],
  physios: ["email", "call"],
  friseure: ["instagram", "email", "call"],
  restaurants: ["instagram", "email", "call"],
  kfz: ["call", "email"],
  kosmetik: ["instagram", "email", "call"],
  verleih: ["email", "linkedin", "call"],
};

export type RouteResult = {
  primary: Channel;
  escalation: Channel[];
};

/**
 * Pure function — picks the primary outreach channel for a lead given
 * the data we have and per-industry preferences. Idempotent.
 */
export function assignChannel(
  lead: Pick<
    Lead,
    | "qualification_tier"
    | "owner_email"
    | "phone"
    | "instagram_url"
    | "owner_linkedin_url"
    | "lead_score"
  >,
  industry: Industry,
): RouteResult {
  // "skip" no longer exists in the enum — keep the legacy check for
  // any old rows still in the DB.
  if ((lead.qualification_tier as string | null) === "skip") {
    return { primary: "none", escalation: [] };
  }

  const has = {
    email: !!lead.owner_email,
    call: !!lead.phone,
    instagram: !!lead.instagram_url,
    linkedin: !!lead.owner_linkedin_url,
  };

  const prefs = PREFS[industry] ?? ["email", "call"];
  let primary: Channel = "email";

  // Hot leads in call-friendly industries → upgrade to call if we have a phone.
  const callFirstIndustries: Industry[] = ["kfz", "aerzte", "verleih"];
  const score = lead.lead_score ?? 0;
  if (
    score >= 90 &&
    has.call &&
    callFirstIndustries.includes(industry)
  ) {
    primary = "call";
  } else {
    for (const ch of prefs) {
      if (ch === "email" && has.email) {
        primary = "email";
        break;
      }
      if (ch === "call" && has.call) {
        primary = "call";
        break;
      }
      if (ch === "instagram" && has.instagram) {
        primary = "instagram";
        break;
      }
      if (ch === "linkedin" && has.linkedin) {
        primary = "linkedin";
        break;
      }
    }
  }

  // Escalation: remaining channels we actually have data for.
  const escalation: Channel[] = [];
  for (const ch of prefs) {
    if (ch === primary) continue;
    if (ch === "email" && has.email) escalation.push("email");
    else if (ch === "call" && has.call) escalation.push("call");
    else if (ch === "instagram" && has.instagram) escalation.push("instagram");
    else if (ch === "linkedin" && has.linkedin) escalation.push("linkedin");
  }

  return { primary, escalation };
}

/**
 * Assign primary_channel + escalation_path to every scored lead that
 * hasn't been routed yet. Idempotent — safe to re-run.
 */
export async function routePendingLeads(
  opts: { limit?: number } = {},
): Promise<{ routed: number; skipped: number }> {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select(
      "id, campaign_id, qualification_tier, owner_email, phone, instagram_url, owner_linkedin_url, lead_score, campaigns(industry)",
    )
    .eq("outreach_status", "scored")
    .is("primary_channel", null)
    .limit(opts.limit ?? 500);

  if (error) throw new Error(`Lead list failed: ${error.message}`);
  if (!data) return { routed: 0, skipped: 0 };

  let routed = 0;
  let skipped = 0;

  for (const row of data as unknown as Array<
    Lead & { campaigns: { industry: Industry } }
  >) {
    const industry = row.campaigns?.industry as Industry | undefined;
    if (!industry) {
      skipped += 1;
      continue;
    }
    const { primary, escalation } = assignChannel(row, industry);

    const { error: updErr } = await db
      .from("leads")
      .update({
        primary_channel: primary,
        escalation_path: escalation,
        channel_assigned_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updErr) {
      skipped += 1;
      continue;
    }
    routed += 1;
  }

  return { routed, skipped };
}
