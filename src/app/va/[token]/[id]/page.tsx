import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobView } from "@/components/content/job-view";
import { clientByVaToken } from "@/lib/content/db";
import { loadJob } from "@/lib/content/editing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editing job", robots: { index: false, follow: false } };

export default async function VaJobPage({ params }: { params: { token: string; id: string } }) {
  const client = await clientByVaToken(params.token);
  if (!client || !/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const job = await loadJob(params.id);
  if (!job || job.item.client_id !== client.id) notFound();
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_60%),linear-gradient(#0b0d12,#0b0d12)] text-white">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <Link href={`/va/${params.token}`} className="text-sm text-white/60 hover:text-white">
          ← Editing
        </Link>
        <JobView
          client={client}
          item={job.item}
          member={job.member}
          inspo={job.inspo}
          uploads={job.uploads}
          token={params.token}
          lang="en"
        />
      </div>
    </div>
  );
}
