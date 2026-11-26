import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditingBoard } from "@/components/content/editing-board";
import { clientByVaToken } from "@/lib/content/db";
import { loadJobs } from "@/lib/content/editing";

/**
 * The video editor's space (English): same board as "Editing" in the
 * Krileo app, reached through one link without login.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editing", robots: { index: false, follow: false } };

export default async function VaPage({ params }: { params: { token: string } }) {
  const client = await clientByVaToken(params.token);
  if (!client) notFound();
  const jobs = await loadJobs(client.id, ["gedreht", "freigabe", "eingeplant", "veroeffentlicht"]);
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_60%),linear-gradient(#0b0d12,#0b0d12)] text-white">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-300">{client.name}</p>
        <EditingBoard jobs={jobs} lang="en" hrefBase={`/va/${params.token}/`} token={params.token} />
        <section className="glass-card rounded-2xl p-4 text-sm text-white/70">
          <p className="font-medium text-white">Style guide</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>9:16 vertical, 1080×1920, MP4 (H.264), under 300 MB. Reels 15–60 s, stories up to 15 s per clip.</li>
            <li>Calm and warm: natural colours, no harsh filters, no flashy transitions, nothing that looks AI-made.</li>
            <li>Brand colours for text: green #2F4A3F, cream #F7E5C5, gold #C99A45. Fonts: Marcellus (titles), Jost (text).</li>
            <li>German subtitles when someone speaks. Make the first 2 seconds count.</li>
            <li>Never add claims about healing or health effects in on-screen text.</li>
            <li>Deliver every cut within 24 hours of the raw takes arriving.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
