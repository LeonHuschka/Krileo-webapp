"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Plus, X, Loader2, Link2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  acceptReviewSuggestion,
  dismissReviewSuggestion,
  linkReviewChat,
} from "@/app/(app)/orders/review-actions";
import type {
  ReviewCategory,
  TelegramReviewSuggestionRow,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

const CAT: Record<ReviewCategory, { label: string; cls: string }> = {
  bug: { label: "Bug", cls: "text-rose-300 border-rose-500/40 bg-rose-500/10" },
  design: {
    label: "Design",
    cls: "text-violet-300 border-violet-500/40 bg-violet-500/10",
  },
  text: { label: "Text", cls: "text-sky-300 border-sky-500/40 bg-sky-500/10" },
  other: {
    label: "Sonstiges",
    cls: "text-zinc-300 border-zinc-500/40 bg-zinc-500/10",
  },
};

export function ReviewSuggestions({
  orderId,
  suggestions,
  reviewChatId,
}: {
  orderId: string;
  suggestions: TelegramReviewSuggestionRow[];
  reviewChatId: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState(
    reviewChatId != null ? String(reviewChatId) : "",
  );
  const [tokenInput, setTokenInput] = useState("");
  const [editingLink, setEditingLink] = useState(false);

  function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      } finally {
        setBusyId(null);
      }
    });
  }

  function saveLink() {
    startTransition(async () => {
      try {
        await linkReviewChat(orderId, chatInput, tokenInput);
        setEditingLink(false);
        setTokenInput("");
        toast.success(
          chatInput.trim() ? "Chat verknüpft + Webhook gesetzt" : "Verknüpfung entfernt",
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Card className="border-sky-500/30">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4 text-sky-400" />
          Aus Telegram
          {suggestions.length > 0 && (
            <Badge className="border-sky-500/40 bg-sky-500/15 text-sky-300">
              {suggestions.length}
            </Badge>
          )}
        </CardTitle>
        <button
          type="button"
          onClick={() => setEditingLink((v) => !v)}
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium",
            reviewChatId != null
              ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
              : "border-border/60 text-muted-foreground hover:text-foreground",
          )}
          title="Kunden-Chat verknüpfen"
        >
          <Link2 className="h-3 w-3" />
          {reviewChatId != null ? "verknüpft" : "verknüpfen"}
        </button>
      </CardHeader>

      <CardContent className="space-y-3">
        {editingLink && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Chat-ID der Kundengruppe (z.B. -5054735540)"
              className="h-8 text-sm"
            />
            <Input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Bot-Token (eigener Bot für DIESE Gruppe)"
              className="h-8 text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Pro Projekt ein eigener Bot. Chat leer lassen = Verknüpfung
                lösen.
              </p>
              <Button
                size="sm"
                onClick={saveLink}
                disabled={pending}
                className="h-8 shrink-0"
              >
                Speichern
              </Button>
            </div>
          </div>
        )}

        {suggestions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {reviewChatId != null
                ? "Noch keine ToDos aus dem Chat. Neue Kundennachrichten werden automatisch ausgewertet und erscheinen hier."
                : "Verknüpfe den Telegram-Chat des Kunden, damit Feedback automatisch als ToDo-Vorschläge erscheint."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s) => {
              const busy = busyId === s.id;
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-2.5"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        CAT[s.category].cls,
                      )}
                    >
                      {CAT[s.category].label}
                    </span>
                    <p className="min-w-0 flex-1 text-sm">{s.body}</p>
                  </div>

                  {s.source_excerpt && (
                    <p className="mt-1 border-l-2 border-border/60 pl-2 text-[11px] italic text-muted-foreground">
                      &bdquo;{s.source_excerpt}&ldquo;
                    </p>
                  )}

                  {s.media.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.media.map((m) =>
                        m.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a key={m.id} href={m.url} target="_blank" rel="noreferrer">
                            <img
                              src={m.url}
                              alt=""
                              className="h-14 w-14 rounded-md border border-border/60 object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            key={m.id}
                            href={m.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-14 items-center rounded-md border border-border/60 bg-muted/30 px-2 text-[10px] text-muted-foreground"
                          >
                            {m.kind === "video" ? "🎬 Video" : "📎 Datei"}
                          </a>
                        ),
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        act(s.id, () => acceptReviewSuggestion(s.id))
                      }
                      disabled={busy}
                      className="h-7 gap-1 bg-sky-600 text-white hover:bg-sky-600/90"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Übernehmen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        act(s.id, () => dismissReviewSuggestion(s.id))
                      }
                      disabled={busy}
                      className="h-7 gap-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                      Verwerfen
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
