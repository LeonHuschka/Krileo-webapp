import { ExternalLink } from "lucide-react";
import { AssetGallery, DownloadAll, DropZone } from "@/components/content/asset-panel";
import { EditNotes } from "@/components/content/edit-notes";
import { isoToLocal } from "@/lib/content/time";
import type { ContentClient, ContentInspo, ContentItem, ContentMember, ContentUpload } from "@/lib/content/types";
import { STATUS_LABEL } from "@/lib/content/types";

type Lang = "de" | "en";

const STATUS_EN: Record<ContentItem["status"], string> = {
  geplant: "To shoot",
  gedreht: "To edit",
  freigabe: "Waiting for approval",
  eingeplant: "Scheduled",
  veroeffentlicht: "Posted",
  fehler: "Failed",
};

const TINT: Record<ContentItem["status"], string> = {
  geplant: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  gedreht: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  freigabe: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  eingeplant: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  veroeffentlicht: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  fehler: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${className ?? "border-white/15 bg-white/5 text-white/80"}`}>{children}</span>;
}

/**
 * One video job, Duraska-style: header with brief + edit notes + inspo,
 * then raw takes (download for CapCut) next to the final cuts (drop zone).
 * Used by the admin page (with the client's VA token) and the VA link.
 */
export function JobView({
  client,
  item,
  member,
  inspo,
  uploads,
  token,
  lang,
}: {
  client: ContentClient;
  item: ContentItem;
  member: ContentMember | null;
  inspo: ContentInspo | null;
  uploads: ContentUpload[];
  token: string;
  lang: Lang;
}) {
  const raws = uploads.filter((u) => u.kind === "raw");
  const cuts = uploads.filter((u) => u.kind === "cut");
  const tz = client.timezone;
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    const { date, time } = isoToLocal(iso, tz);
    return `${date.slice(8)}.${date.slice(5, 7)}. ${time}`;
  };
  const inspoUrl = item.inspo_url ?? inspo?.url ?? null;
  const inspoThumb = inspo?.thumb_data ?? inspo?.thumbnail_url ?? null;
  const canEditCuts = ["gedreht", "freigabe"].includes(item.status);
  const de = lang === "de";

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-3xl p-5">
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-2xl font-semibold">{item.title}</h1>
            <div className="flex flex-wrap gap-1.5">
              <Chip className={TINT[item.status]}>{de ? STATUS_LABEL[item.status] : STATUS_EN[item.status]}</Chip>
              <Chip>{item.kind === "story" ? "Story" : "Reel"}</Chip>
              {item.area && <Chip>{item.area}</Chip>}
              {member && <Chip>🎥 {member.name}</Chip>}
              {item.publish_at && <Chip>{de ? "Posten" : "Goes live"} {fmt(item.publish_at)}</Chip>}
            </div>
            {item.brief && <p className="whitespace-pre-line rounded-xl bg-white/5 p-3 text-sm text-white/80">{item.brief}</p>}
            {item.shots.length > 0 && (
              <ol className="list-decimal space-y-0.5 pl-5 text-sm text-white/70">
                {item.shots.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            )}
            {item.note_va && (
              <p className="rounded-xl border-l-4 border-amber-500 bg-amber-500/10 p-3 text-sm">
                <strong>{de ? "Änderungswunsch:" : "Changes requested:"}</strong> {item.note_va}
              </p>
            )}
            {inspoUrl && (
              <a
                href={inspoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/5 px-3 py-2 text-sm hover:bg-violet-500/10"
              >
                <ExternalLink className="h-4 w-4 text-violet-300" />
                <span className="truncate">{inspoUrl}</span>
              </a>
            )}
          </div>
          <div className="flex gap-4">
            <div className="w-full sm:w-72">
              <EditNotes token={token} itemId={item.id} initial={item.edit_notes ?? []} lang={lang} />
            </div>
            {(inspoThumb || inspoUrl) && (
              <a
                href={inspoUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="relative block aspect-[9/16] w-32 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/5 sm:w-40"
              >
                {inspoThumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inspoThumb} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-6 text-[11px]">
                  Inspo reel ↗
                </span>
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass-card space-y-3 rounded-3xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">
                {de ? "Rohvideos" : "Raw takes"} ({raws.length})
              </h2>
              <p className="text-xs text-white/50">
                {de ? `Alles, was ${member?.name ?? "das Team"} gedreht hat` : `All takes ${member?.name ?? "the team"} shot for this video`}
              </p>
            </div>
            <DownloadAll uploads={raws} token={token} title={item.title} lang={lang} />
          </div>
          {raws.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/15 py-8 text-center text-sm text-white/50">
              {de ? "Noch nichts hochgeladen" : "No takes yet"}
            </p>
          )}
          <AssetGallery uploads={raws} token={token} itemId={item.id} canDelete={false} lang={lang} />
          {item.drive_folder_url && (
            <a href={item.drive_folder_url} target="_blank" rel="noreferrer" className="inline-block text-xs text-white/50 underline">
              {de ? "Drive-Ordner öffnen" : "Open Drive folder"}
            </a>
          )}
        </section>

        <section className="glass-card space-y-3 rounded-3xl p-5">
          <div>
            <h2 className="font-semibold">
              {de ? "Fertige Schnitte" : "Final cuts"} ({cuts.length})
            </h2>
            <p className="text-xs text-white/50">
              {de
                ? "Fertigen Schnitt hochladen – der neueste wird gepostet"
                : "Upload the finished cut(s) – the newest one gets posted"}
            </p>
          </div>
          {canEditCuts && (
            <DropZone
              role="va"
              token={token}
              itemId={item.id}
              lang={lang}
              label={de ? "Fertige Schnitte hier ablegen oder klicken" : "Drop the Instagram cuts here or click"}
            />
          )}
          <AssetGallery uploads={[...cuts].reverse()} token={token} itemId={item.id} canDelete={canEditCuts} lang={lang} />
        </section>
      </div>
    </div>
  );
}
