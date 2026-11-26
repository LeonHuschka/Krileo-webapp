"use client";

import { useState } from "react";
import { checkCaption, disclaimerFor } from "@/lib/content/legal";

/** Caption with a live check against the advertising rules. */
export function CaptionField({
  defaultValue,
  area,
  className,
}: {
  defaultValue: string;
  area: string | null;
  className?: string;
}) {
  const [text, setText] = useState(defaultValue);
  const hits = checkCaption(text);
  const disclaimer = disclaimerFor(area);
  const hasDisclaimer = disclaimer ? text.includes(disclaimer) : true;

  return (
    <div className="space-y-2">
      <textarea
        name="caption"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={className}
        placeholder="Caption auf Deutsch, Sie-Form. Zum Schluss: wie man einen Termin bekommt (Telefon oder Link in der Bio)."
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{text.length} / 2200 Zeichen</span>
        {disclaimer && !hasDisclaimer && (
          <button
            type="button"
            onClick={() => setText((t) => `${t.trimEnd()}\n\n${disclaimer}`)}
            className="rounded border border-border px-2 py-0.5 hover:bg-accent"
          >
            + Pflichthinweis anhängen
          </button>
        )}
      </div>
      {hits.length > 0 && (
        <ul className="space-y-0.5 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
          {hits.map((h) => (
            <li key={h.word}>
              ⚠️ <strong>{h.word}</strong> – {h.why}
            </li>
          ))}
        </ul>
      )}
      {disclaimer && !hasDisclaimer && (
        <p className="text-xs text-amber-300">Für diesen Bereich fehlt der Pflichthinweis.</p>
      )}
    </div>
  );
}
