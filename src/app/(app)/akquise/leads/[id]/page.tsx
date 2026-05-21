import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Star,
  ExternalLink,
} from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RescoreButton } from "@/components/akquise/lead-actions";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/lead-engine/types";

export const dynamic = "force-dynamic";

const TIER_COLORS: Record<string, string> = {
  hot: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  warm: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  cold: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  skip: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  call: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  instagram: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300",
  linkedin: "border-blue-500/40 bg-blue-500/15 text-blue-300",
  none: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
};

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("*, campaigns(industry, city)")
    .eq("id", params.id)
    .single();

  if (error || !data) notFound();

  const lead = data as unknown as Lead & {
    campaigns?: { industry: string; city: string };
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <Link
        href="/akquise/leads"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Lead-Browser
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {lead.business_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {lead.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {lead.city}
                </span>
              )}
              {lead.category && <span>{lead.category}</span>}
              {lead.google_rating != null && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  {lead.google_rating} · {lead.google_reviews_count ?? 0}{" "}
                  Bewertungen
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {lead.qualification_tier && (
                <Badge
                  variant="outline"
                  className={cn(
                    "border text-xs font-semibold uppercase",
                    TIER_COLORS[lead.qualification_tier],
                  )}
                >
                  {lead.qualification_tier}
                </Badge>
              )}
              {lead.primary_channel && (
                <Badge
                  variant="outline"
                  className={cn(
                    "border text-xs font-semibold uppercase",
                    CHANNEL_COLORS[lead.primary_channel],
                  )}
                >
                  {lead.primary_channel}
                </Badge>
              )}
            </div>
            {lead.lead_score != null && (
              <span className="text-4xl font-bold tabular-nums leading-none">
                {lead.lead_score}
              </span>
            )}
            <RescoreButton leadId={lead.id} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Pain hook */}
          {lead.personalized_hook && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">
                Personalized Hook
              </div>
              <p className="text-base leading-snug">
                {lead.personalized_hook}
              </p>
            </div>
          )}

          {/* Pain points */}
          {lead.pain_points && lead.pain_points.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pain Points
              </div>
              <ul className="space-y-1.5">
                {lead.pain_points.map((p, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-border/50 bg-card/60 px-3 py-2 text-sm"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contact CTAs */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {lead.phone && (
              <Button
                asChild
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <a href={`tel:${lead.phone}`}>
                  <Phone className="h-4 w-4" />
                  <span className="font-mono">{lead.phone}</span>
                </a>
              </Button>
            )}
            {lead.owner_email && (
              <Button asChild variant="outline" className="gap-2">
                <a href={`mailto:${lead.owner_email}`}>
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{lead.owner_email}</span>
                </a>
              </Button>
            )}
            {lead.website_url && (
              <Button asChild variant="outline" className="gap-2">
                <a
                  href={lead.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Website
                </a>
              </Button>
            )}
            {lead.instagram_url && (
              <Button asChild variant="outline" className="gap-2">
                <a
                  href={lead.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Instagram
                </a>
              </Button>
            )}
            {lead.facebook_url && (
              <Button asChild variant="outline" className="gap-2">
                <a
                  href={lead.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Facebook
                </a>
              </Button>
            )}
            {lead.google_url && (
              <Button asChild variant="outline" className="gap-2">
                <a
                  href={lead.google_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="h-4 w-4" />
                  Google Maps
                </a>
              </Button>
            )}
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Meta label="Branche" value={lead.campaigns?.industry} />
            <Meta label="Status" value={lead.outreach_status} />
            <Meta label="Fit Offer" value={lead.fit_offer} />
            <Meta label="Adresse" value={lead.address} />
            <Meta
              label="Escalation"
              value={
                lead.escalation_path && lead.escalation_path.length > 0
                  ? lead.escalation_path.join(" → ")
                  : "—"
              }
            />
            <Meta
              label="Gescored am"
              value={
                lead.updated_at
                  ? new Date(lead.updated_at).toLocaleString("de-DE")
                  : null
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm">{value || "—"}</div>
    </div>
  );
}
