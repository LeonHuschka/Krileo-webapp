"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FolderDown, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { finishUpload, removeUpload, startUpload } from "@/app/d/actions";
import { uploadToDrive } from "@/components/content/chunked-upload";
import type { ContentUpload } from "@/lib/content/types";
import { cn } from "@/lib/utils";

type Lang = "de" | "en";

const fileUrl = (id: string, token?: string, dl?: string) => {
  const p = new URLSearchParams();
  if (token) p.set("t", token);
  if (dl) p.set("dl", dl);
  const s = p.toString();
  return `/api/content/file/${id}${s ? `?${s}` : ""}`;
};
const thumbUrl = (id: string, token?: string) => `/api/content/thumb/${id}${token ? `?t=${token}` : ""}`;

function mb(n: number | null) {
  return n ? `${(n / 1_048_576).toFixed(n > 100 * 1_048_576 ? 0 : 1)} MB` : "";
}

/** Grid of videos (9:16, poster = Drive thumbnail, plays on click) with download / delete. */
export function AssetGallery({
  uploads,
  token,
  itemId,
  canDelete,
  lang,
}: {
  uploads: ContentUpload[];
  token: string;
  itemId: string;
  canDelete: boolean;
  lang: Lang;
}) {
  const router = useRouter();
  const [playing, setPlaying] = useState<string | null>(null);
  if (!uploads.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {uploads.map((u) => (
        <div key={u.id} className="group overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <div className="relative aspect-[9/16]">
            {playing === u.id ? (
              <video src={fileUrl(u.drive_file_id, token)} controls autoPlay playsInline className="h-full w-full object-contain" />
            ) : (
              <button onClick={() => setPlaying(u.id)} className="h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(u.drive_file_id, token)} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            )}
            <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <a
                href={fileUrl(u.drive_file_id, token, u.name ?? "video.mp4")}
                className="rounded-full bg-black/60 p-1.5 backdrop-blur hover:bg-black/80"
                title={lang === "de" ? "Herunterladen" : "Download"}
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              {canDelete && (
                <button
                  onClick={async () => {
                    if (!window.confirm(lang === "de" ? "Datei löschen?" : "Delete this file?")) return;
                    const r = await removeUpload({ token, itemId, uploadId: u.id });
                    if (!r.ok) toast.error(r.error);
                    else router.refresh();
                  }}
                  className="rounded-full bg-black/60 p-1.5 backdrop-blur hover:bg-red-600"
                  title={lang === "de" ? "Löschen" : "Delete"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="truncate px-2 py-1.5 text-[11px] text-white/60">
            {u.name} {u.size ? `· ${mb(u.size)}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Download for CapCut": all takes, numbered, into one folder (or one by one). */
export function DownloadAll({
  uploads,
  token,
  title,
  lang,
}: {
  uploads: ContentUpload[];
  token: string;
  title: string;
  lang: Lang;
}) {
  const [progress, setProgress] = useState<string | null>(null);
  if (!uploads.length) return null;
  const base = title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "video";

  async function run() {
    const files = uploads.map((u, i) => ({
      url: fileUrl(u.drive_file_id, token),
      name: `${base} - ${String(i + 1).padStart(2, "0")} take${(u.name ?? "").match(/\.\w+$/)?.[0] ?? ".mp4"}`,
    }));
    const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
    try {
      if (picker) {
        const dir = await picker();
        for (let i = 0; i < files.length; i++) {
          setProgress(`${i + 1}/${files.length}`);
          const res = await fetch(files[i].url);
          if (!res.ok || !res.body) throw new Error(`Download ${res.status}`);
          const handle = await dir.getFileHandle(files[i].name, { create: true });
          const w = await handle.createWritable();
          await res.body.pipeTo(w);
        }
      } else {
        for (let i = 0; i < files.length; i++) {
          setProgress(`${i + 1}/${files.length}`);
          const a = document.createElement("a");
          a.href = `${files[i].url}${files[i].url.includes("?") ? "&" : "?"}dl=${encodeURIComponent(files[i].name)}`;
          a.click();
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      toast.success(lang === "de" ? "Alle Takes geladen" : "All takes downloaded");
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error((err as Error).message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <button
      onClick={run}
      disabled={!!progress}
      className="glass-pill flex items-center gap-2 rounded-full px-3 py-1.5 text-xs hover:bg-white/15 disabled:opacity-60"
    >
      <FolderDown className="h-3.5 w-3.5" />
      {progress
        ? `${lang === "de" ? "Lädt" : "Downloading"} ${progress}`
        : lang === "de"
          ? "Alle für CapCut laden"
          : "Download for CapCut"}
    </button>
  );
}

/** Drop zone for files → straight into the video's Drive folder. */
export function DropZone({
  role,
  token,
  itemId,
  label,
  lang,
}: {
  role: "va" | "member";
  token: string;
  itemId: string;
  label: string;
  lang: Lang;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function handle(list: File[]) {
    const files = list.filter((f) => f.type.startsWith("video/") || /\.(mov|mp4|m4v)$/i.test(f.name));
    if (!files.length) return;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const s = await startUpload({ role, token, itemId, name: f.name, mime: f.type, size: f.size });
        if (!s.ok) throw new Error(s.error);
        const id = await uploadToDrive(s.url, f, (p) =>
          setBusy(`${files.length > 1 ? `${i + 1}/${files.length} · ` : ""}${Math.round(p * 100)} %`),
        );
        const r = await finishUpload({ role, token, itemId, fileId: id, last: i === files.length - 1 });
        if (!r.ok) throw new Error(r.error);
      }
      toast.success(lang === "de" ? "Hochgeladen" : "Uploaded");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(Array.from(e.dataTransfer.files));
      }}
      onClick={() => !busy && input.current?.click()}
      className={cn(
        "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center text-sm transition-colors",
        over ? "border-violet-400 bg-violet-500/10" : "border-white/15 hover:border-white/30",
      )}
    >
      <input
        ref={input}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => handle(Array.from(e.target.files ?? []))}
      />
      <UploadCloud className="h-6 w-6 text-white/50" />
      {busy ? (
        <span>
          {lang === "de" ? "Lädt hoch …" : "Uploading…"} {busy}
        </span>
      ) : (
        <span className="text-white/70">{label}</span>
      )}
    </div>
  );
}
