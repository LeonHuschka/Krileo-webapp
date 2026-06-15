import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Star,
  ExternalLink,
  Target,
} from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { listUpcomingAppointments } from "@/lib/lead-engine/appointments";
import { listGoogleEvents } from "@/lib/google/calendar";
import { loadGoogleConfig } from "@/lib/google/storage";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RescoreButton } from "@/components/akquise/lead-actions";
import { AppointmentDialog } from "@/components/akquise/appointment-dialog";
import { AppointmentRow } from "@/components/akquise/appointment-row";
import { DayCalendar, type ExternalEvent } from "@/components/akquise/day-calendar";
import { LeadNotes } from "@/components/akquise/lead-notes";
import { NextStepButton } from "@/components/akquise/next-step-button";
import { DemoLinkButton } from "@/components/akquise/demo-link-button";
import { OnHoldButton } from "@/components/akquise/on-hold-button";
import { PhoneManager } from "@/components/akquise/phone-manager";
import { SalesPointsEditor } from "@/components/akquise/sales-points-editor";
import { PrepQuestions } from "@/components/akquise/prep-questions";
import { cn } from "@/lib/utils";
import type { Appointment, Lead } from "@/lib/lead-engine/types";

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

type ApptWithLead = Appointment & {
  lead?: { business_name: string; owner_name?: string | null } | null;
  leads?: {
    business_name: string;
    phone: string | null;
    city: string | null;
    owner_name: string | null;
    owner_email: string | null;
  } | null;
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

  // This lead's own appointments (shown as a list below)
  let leadAppointments: ApptWithLead[] = [];
  try {
    const { data: appts } = await db
      .from("appointments")
      .select("*, leads(business_name, phone, city, owner_name, owner_email)")
      .eq("lead_id", lead.id)
      .order("scheduled_for", { ascending: true })
      .limit(20);
    leadAppointments = (appts ?? []) as unknown as ApptWithLead[];
  } catch {
    /* table may not exist yet */
  }

  // ALL upcoming appointments + Google events → calendar sidebar so a
  // booked meeting never collides with something already in the day.
  let calAppointments: ApptWithLead[] = [];
  try {
    calAppointments = (await listUpcomingAppointments({
      daysAhead: 7,
      limit: 50,
    })) as ApptWithLead[];
  } catch {
    /* non-fatal */
  }
  let externalEvents: ExternalEvent[] = [];
  const googleCfg = await loadGoogleConfig();
  if (googleCfg) {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const events = await listGoogleEvents({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
      });
      externalEvents = events
        .filter((e) => e.start?.dateTime && e.end?.dateTime)
        .map((e) => ({
          id: e.id,
          startIso: e.start!.dateTime!,
          endIso: e.end!.dateTime!,
          title: e.summary ?? "(ohne Titel)",
          location: e.location ?? null,
          htmlLink: e.htmlLink,
        }));
    } catch {
      /* non-fatal */
    }
  }

  const priceRange =
    lead.suggested_price_min_eur != null && lead.suggested_price_max_eur != null
      ? `${lead.suggested_price_min_eur.toLocaleString("de-DE")}–${lead.suggested_price_max_eur.toLocaleString("de-DE")} €`
      : null;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Link
        href="/akquise/leads"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Lead-Browser
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* ── Center column: card + meeting prep ───────────────────── */}
        <div className="space-y-4 lg:order-2 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="flex-1 space-y-2">
                {lead.owner_name && (
                  <div className="text-sm font-medium text-primary">
                    {lead.owner_name}
                  </div>
                )}
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
                <div className="flex flex-col gap-1.5">
                  <AppointmentDialog
                    leadId={lead.id}
                    triggerLabel="Termin legen"
                    triggerVariant="default"
                    defaultLeadName={lead.business_name}
                  />
                  <NextStepButton
                    leadId={lead.id}
                    nextStep={lead.next_step}
                    nextStepAt={lead.next_step_at}
                  />
                  <OnHoldButton leadId={lead.id} />
                  <RescoreButton leadId={lead.id} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Hook */}
              {lead.personalized_hook && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">
                    Hook
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

              {/* Offer block */}
              {(lead.fit_offer || lead.fit_offer_pitch || priceRange) && (
                <div className="space-y-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      <Target className="h-3.5 w-3.5" /> Offer
                    </span>
                    {lead.fit_offer && (
                      <Badge
                        variant="outline"
                        className="border-border/60 bg-card text-[10px] uppercase"
                      >
                        {lead.fit_offer}
                      </Badge>
                    )}
                    {priceRange && (
                      <span className="font-semibold tabular-nums text-emerald-300">
                        {priceRange}
                      </span>
                    )}
                    {lead.business_size && (
                      <span className="text-xs text-muted-foreground">
                        · {lead.business_size}
                      </span>
                    )}
                  </div>
                  {lead.fit_offer_pitch && (
                    <p className="text-sm leading-snug text-foreground">
                      {lead.fit_offer_pitch}
                    </p>
                  )}
                </div>
              )}

              {/* Contact CTAs */}
              <div className="space-y-2">
                <PhoneManager
                  leadId={lead.id}
                  primaryPhone={lead.phone}
                  additional={lead.additional_phones ?? []}
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                    <a href={lead.website_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Website
                    </a>
                  </Button>
                )}
                {lead.instagram_url && (
                  <Button asChild variant="outline" className="gap-2">
                    <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Instagram
                    </a>
                  </Button>
                )}
                {lead.google_url && (
                  <Button asChild variant="outline" className="gap-2">
                    <a href={lead.google_url} target="_blank" rel="noopener noreferrer">
                      <MapPin className="h-4 w-4" /> Google Maps
                    </a>
                  </Button>
                )}
                <DemoLinkButton leadId={lead.id} demoUrl={lead.demo_url} />
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Meta label="Branche" value={lead.campaigns?.industry} />
                <Meta label="Status" value={lead.outreach_status} />
                <Meta label="Adresse" value={lead.address} />
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

          {leadAppointments.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Termine zu diesem Lead
              </h2>
              <div className="space-y-2">
                {leadAppointments.map((a) => (
                  <AppointmentRow key={a.id} appt={a as never} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Left column: notes + sales args + prep ───────────────── */}
        <div className="space-y-4 lg:order-1 lg:col-span-2">
          <LeadNotes
            leadId={lead.id}
            initial={{
              met_location: lead.met_location,
              meeting_notes: lead.meeting_notes,
              close_notes: lead.close_notes,
              sale_notes: lead.sale_notes,
            }}
          />
          <SalesPointsEditor leadId={lead.id} initial={lead.sales_points} />
          <PrepQuestions leadId={lead.id} initialQa={lead.prep_qa ?? null} />
        </div>

        {/* ── Right column: calendar ──────────────────────────────── */}
        <div className="space-y-4 lg:order-3 lg:col-span-1">
          <div className="lg:sticky lg:top-4">
            <DayCalendar
              appointments={calAppointments as never}
              externalEvents={externalEvents}
            />
          </div>
        </div>
      </div>
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
