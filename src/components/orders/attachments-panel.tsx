"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2, X, FileIcon, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { updateOrder } from "@/app/(app)/orders/actions";
import type { Attachment } from "@/lib/types/database";

const BUCKET = "order-previews";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.floor(Math.random() * 1e9).toString(36);
}

function kindOf(type: string): Attachment["kind"] {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return "file";
}

/** order-previews public URL → storage object path (for deletion). */
function pathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export function AttachmentsPanel({
  orderId,
  initialAttachments,
}: {
  orderId: string;
  initialAttachments: Attachment[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  function persist(next: Attachment[]) {
    setItems(next);
    startTransition(async () => {
      try {
        await updateOrder(orderId, { attachments: next });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    const supabase = createClient();
    const added: Attachment[] = [];
    try {
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const path = `${orderId}/att-${Date.now()}-${newId().slice(0, 6)}.${ext}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) {
          toast.error(`${file.name}: ${error.message}`);
          continue;
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        added.push({
          id: newId(),
          url: data.publicUrl,
          name: file.name,
          kind: kindOf(file.type),
          size: file.size,
        });
      }
      if (added.length) {
        persist([...items, ...added]);
        toast.success(`${added.length} Anhang/Anhänge hochgeladen`);
      }
    } finally {
      setUploading(false);
    }
  }

  async function remove(att: Attachment) {
    persist(items.filter((a) => a.id !== att.id));
    const path = pathFromUrl(att.url);
    if (path) {
      try {
        await createClient().storage.from(BUCKET).remove([path]);
      } catch {
        /* leaving the object is harmless */
      }
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="h-4 w-4 text-primary" />
          Anhänge & Notizen
        </CardTitle>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-8 gap-1.5 text-xs"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Hochladen
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          hidden
          onChange={onFiles}
        />
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Bilder, Videos, Dateien — später von der Automation befüllt.
        </p>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/50 bg-muted/10 py-10 text-center text-xs text-muted-foreground/60">
            <Paperclip className="h-5 w-5" />
            Noch keine Anhänge
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((att) => (
              <div
                key={att.id}
                className="group relative overflow-hidden rounded-lg border border-border/50 bg-muted/20"
              >
                <button
                  type="button"
                  onClick={() => remove(att)}
                  className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100"
                  title="Entfernen"
                >
                  <X className="h-3 w-3" />
                </button>
                {att.kind === "image" ? (
                  <a href={att.url} target="_blank" rel="noreferrer noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.url}
                      alt={att.name}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  </a>
                ) : att.kind === "video" ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={att.url}
                    controls
                    className="aspect-square w-full bg-black object-cover"
                  />
                ) : (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex aspect-square flex-col items-center justify-center gap-1.5 p-2 text-center"
                  >
                    <FileIcon className="h-6 w-6 text-muted-foreground" />
                    <span className="line-clamp-2 break-all text-[10px] text-muted-foreground">
                      {att.name}
                    </span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
