"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finishUpload, startUpload } from "@/app/d/actions";
import { uploadToDrive } from "@/components/content/chunked-upload";

type Labels = {
  pick: string;
  uploading: (i: number, n: number) => string;
  done: string;
  error: string;
};

const DE: Labels = {
  pick: "📤 Videos hochladen",
  uploading: (i, n) => (n > 1 ? `Video ${i} von ${n} wird hochgeladen …` : "Video wird hochgeladen …"),
  done: "✅ Danke! Ist angekommen.",
  error: "Das hat nicht geklappt. Bitte nochmal versuchen – oder Leon kurz schreiben.",
};

const EN: Labels = {
  pick: "Upload final cut",
  uploading: () => "Uploading …",
  done: "Uploaded – waiting for approval.",
  error: "Upload failed. Please try again.",
};

export function UploadButton({
  role,
  token,
  itemId,
  multiple = true,
  className,
}: {
  role: "member" | "va";
  token: string;
  itemId: string;
  multiple?: boolean;
  className?: string;
}) {
  const t = role === "va" ? EN : DE;
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [label, setLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setState("busy");
    setDetail("");
    try {
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        setLabel(t.uploading(i + 1, list.length));
        setProgress(0);
        const s = await startUpload({ role, token, itemId, name: f.name, mime: f.type, size: f.size });
        if (!s.ok) throw new Error(s.error);
        const fileId = await uploadToDrive(s.url, f, setProgress);
        const done = await finishUpload({ role, token, itemId, fileId, last: i === list.length - 1 });
        if (!done.ok) throw new Error(done.error);
      }
      setState("done");
      router.refresh();
    } catch (err) {
      setState("error");
      setDetail(err instanceof Error ? err.message : "");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={className}>
      <input
        ref={input}
        type="file"
        accept="video/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      {state === "busy" ? (
        <div className="space-y-2">
          <p className="font-medium">{label}</p>
          <div className="h-4 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[#C99A45] transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-sm opacity-70">
            {Math.round(progress * 100)} %{role === "member" ? " – bitte die Seite offen lassen" : ""}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={
            role === "va"
              ? "rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              : "w-full rounded-2xl bg-[#2F4A3F] px-6 py-5 text-xl font-medium text-[#F7E5C5] shadow-md active:scale-[0.99]"
          }
        >
          {t.pick}
        </button>
      )}
      {state === "done" && <p className="mt-3 font-medium text-emerald-700">{t.done}</p>}
      {state === "error" && (
        <p className="mt-3 text-red-700">
          {t.error}
          {detail ? <span className="block text-sm opacity-70">({detail})</span> : null}
        </p>
      )}
    </div>
  );
}
