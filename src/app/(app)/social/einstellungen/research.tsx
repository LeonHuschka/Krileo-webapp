import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/content/action-form";
import { contentDb } from "@/lib/content/db";
import { DEFAULT_BRIEF } from "@/lib/content/research-ai";
import type { ContentClient, ContentWatchAccount } from "@/lib/content/types";
import { addWatchAccount, deleteWatchAccount, saveResearchSettings, toggleWatchAccount } from "../actions";
import { Glass, fmtNum, inputCls } from "../shared";

export async function ResearchSection({ client }: { client: ContentClient }) {
  const { data } = await contentDb()
    .from("content_watch_accounts")
    .select("*")
    .eq("client_id", client.id)
    .order("username");
  const accounts = (data ?? []) as ContentWatchAccount[];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Glass className="space-y-3">
        <h2 className="font-medium">Beobachtete Accounts ({accounts.filter((a) => a.active).length})</h2>
        <p className="text-sm text-muted-foreground">
          Der Research-Agent holt jeden Morgen die neuesten Reels dieser Accounts, vergleicht sie mit deren üblichen Views und lässt
          die Ausreißer von der KI für {client.name} bewerten.
        </p>
        <ActionForm action={addWatchAccount} success="Hinzugefügt" reset className="flex gap-2">
          <input type="hidden" name="client_id" value={client.id} />
          <input name="usernames" placeholder="@account1 @account2 … oder Instagram-Links" className={inputCls} />
          <Button size="sm">Hinzufügen</Button>
        </ActionForm>
        <ul className="divide-y divide-white/5 text-sm">
          {accounts.length === 0 && <li className="py-3 text-muted-foreground">Noch keine Accounts.</li>}
          {accounts.map((a) => (
            <li key={a.id} className={`flex items-center justify-between gap-2 py-2 ${a.active ? "" : "opacity-50"}`}>
              <div className="min-w-0">
                <a href={`https://instagram.com/${a.username}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  @{a.username}
                </a>
                <div className="truncate text-xs text-muted-foreground">
                  {a.median_views ? `Ø ${fmtNum(a.median_views)} Views` : "noch nicht gescrapt"}
                  {a.last_error ? ` · Fehler: ${a.last_error}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <ActionForm action={toggleWatchAccount}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="active" value={a.active ? "false" : "true"} />
                  <button className="text-muted-foreground underline">{a.active ? "Pausieren" : "Aktivieren"}</button>
                </ActionForm>
                <ActionForm action={deleteWatchAccount} confirm={`@${a.username} entfernen?`}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-red-400 underline">Entfernen</button>
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      </Glass>

      <Glass>
        <ActionForm action={saveResearchSettings} success="Gespeichert" className="space-y-3">
          <input type="hidden" name="client_id" value={client.id} />
          <h2 className="font-medium">Kunden-Briefing für die KI</h2>
          <p className="text-sm text-muted-foreground">
            Danach bewertet die KI jedes Reel. Leer lassen = Standard-Briefing für Balance Oase.
          </p>
          <textarea name="research_brief" rows={12} defaultValue={client.research_brief ?? ""} placeholder={DEFAULT_BRIEF} className={inputCls} />
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Hashtags zum Mitscrapen (optional)</span>
            <input
              name="hashtags"
              defaultValue={client.research_hashtags.map((h) => `#${h}`).join(" ")}
              placeholder="#headspa #zahnaufhellung #bioresonanz"
              className={inputCls}
            />
          </label>
          <Button size="sm">Speichern</Button>
        </ActionForm>
      </Glass>
    </div>
  );
}
