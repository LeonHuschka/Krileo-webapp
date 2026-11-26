import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/content/action-form";
import { CopyButton } from "@/components/content/copy-button";
import { appUrl } from "@/lib/content/db";
import { driveStatus } from "@/lib/content/drive";
import { loadIgConnection } from "@/lib/content/publish";
import { currentClient } from "@/lib/content/social";
import {
  connectInstagram,
  createContentClient,
  createDriveRoot,
  disconnectDriveAction,
  disconnectInstagram,
  newVaLink,
  updateClientSettings,
} from "../actions";
import { Glass, PageHeader, PillTabs, inputCls } from "../shared";
import { FormatsSection, TeamSection } from "./team";
import { ResearchSection } from "./research";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "team", label: "Team" },
  { key: "formate", label: "Formate" },
  { key: "research", label: "Research" },
  { key: "verbindungen", label: "Verbindungen" },
];

export default async function SocialSettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string; drive?: string; msg?: string };
}) {
  const { client, clients } = await currentClient();
  const tab = TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab! : searchParams.drive ? "verbindungen" : "team";

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader title="Einstellungen" subtitle={client ? client.name : "Social Media"} />
      {client && (
        <PillTabs current={tab} tabs={TABS.map((t) => ({ ...t, href: `/social/einstellungen?tab=${t.key}` }))} />
      )}

      {client && tab === "team" && <TeamSection client={client} />}
      {client && tab === "formate" && <FormatsSection client={client} />}
      {client && tab === "research" && <ResearchSection client={client} />}
      {(!client || tab === "verbindungen") && (
        <Connections client={client} clientsCount={clients.length} drive={searchParams.drive} msg={searchParams.msg} />
      )}
    </div>
  );
}

async function Connections({
  client,
  clientsCount,
  drive: driveFlag,
  msg,
}: {
  client: Awaited<ReturnType<typeof currentClient>>["client"];
  clientsCount: number;
  drive?: string;
  msg?: string;
}) {
  const drive = await driveStatus().catch(() => ({ connected: false, email: null }));
  const ig = client ? await loadIgConnection(client.id) : null;
  const base = appUrl();
  const cronSql = `select cron.schedule('content-publish', '*/5 * * * *', $$
  select net.http_get(
    url := '${base}/api/cron/content-publish',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
    timeout_milliseconds := 290000
  );
$$);`;

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      {driveFlag === "connected" && (
        <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300 lg:col-span-2">Google Drive ist verbunden.</p>
      )}
      {driveFlag === "error" && (
        <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 lg:col-span-2">Drive-Verbindung fehlgeschlagen: {msg}</p>
      )}

      <Glass className="space-y-2">
        <h2 className="font-medium">Google Drive · Ablage für alle Videos</h2>
        {drive.connected ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              Verbunden mit <strong>{drive.email}</strong>
            </span>
            <ActionForm action={disconnectDriveAction} confirm="Drive-Verbindung trennen? Uploads gehen dann nicht mehr.">
              <Button size="sm" variant="outline">
                Trennen
              </Button>
            </ActionForm>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <a href="/api/content/drive/connect">
              <Button size="sm">Mit Google Drive verbinden</Button>
            </a>
            <p className="text-xs text-muted-foreground">
              Mit dem Google-Konto anmelden, in dessen Drive die Videos liegen sollen. Die App sieht nur die Ordner, die sie selbst
              anlegt. Vorher in der Google Cloud Console die „Google Drive API“ aktivieren.
            </p>
          </div>
        )}
        {client && drive.connected && (
          <div className="text-sm">
            {client.drive_root_url ? (
              <a href={client.drive_root_url} target="_blank" rel="noreferrer" className="underline">
                Ordner „{client.name} – Content (Krileo)“ öffnen
              </a>
            ) : (
              <ActionForm action={createDriveRoot} success="Ordner angelegt">
                <input type="hidden" name="client_id" value={client.id} />
                <Button size="sm" variant="outline">
                  Hauptordner für {client.name} anlegen
                </Button>
              </ActionForm>
            )}
          </div>
        )}
      </Glass>

      {client && (
        <Glass className="space-y-2">
          <h2 className="font-medium">Instagram · automatisch posten</h2>
          {ig ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                Verbunden: <strong>@{ig.username}</strong>
                {ig.expires_at ? ` · Token bis ${ig.expires_at.slice(0, 10).split("-").reverse().join(".")}` : " · Token läuft nicht ab"}
              </span>
              <ActionForm action={disconnectInstagram} confirm="Instagram trennen? Eingeplante Videos warten dann.">
                <input type="hidden" name="client_id" value={client.id} />
                <Button size="sm" variant="outline">
                  Trennen
                </Button>
              </ActionForm>
            </div>
          ) : (
            <ActionForm action={connectInstagram} success="Instagram verbunden" className="space-y-2">
              <input type="hidden" name="client_id" value={client.id} />
              <input name="ig_username" defaultValue={client.ig_username ?? ""} placeholder="@instagram_name" className={inputCls} />
              <input name="token" placeholder="Access Token (IGAA… oder EAA…)" className={inputCls} autoComplete="off" />
              <input name="account_id" placeholder="Instagram-Account-ID (nur bei EAA-System-Token)" className={inputCls} />
              <Button size="sm">Verbinden</Button>
              <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
                <li>Instagram-Konto auf „Professionell → Business“ umstellen.</li>
                <li>Eigene Meta-App im Business-Portfolio von Krileo bzw. des Kunden anlegen (nicht die Duraska-App), Anwendungsfall „Instagram API“.</li>
                <li>Konto als Instagram-Tester hinzufügen und in der App bestätigen.</li>
                <li>Anwendungsfälle → Instagram API → „Zugriffstokens generieren“ → Token hier einfügen.</li>
              </ol>
            </ActionForm>
          )}
        </Glass>
      )}

      {client && (
        <Glass className="space-y-2">
          <h2 className="font-medium">Video-Editor (VA)</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <code className="max-w-full truncate rounded bg-black/30 px-2 py-1 text-xs">
              {base}/va/{client.va_token}
            </code>
            <CopyButton text={`${base}/va/${client.va_token}`} label="Link kopieren" />
            <ActionForm action={newVaLink} confirm="Neuen VA-Link erzeugen? Der alte funktioniert dann nicht mehr.">
              <input type="hidden" name="client_id" value={client.id} />
              <button className="text-xs text-muted-foreground underline">Neuer Link</button>
            </ActionForm>
          </div>
          <p className="text-xs text-muted-foreground">
            Die VA schneidet über diesen Link (gleiche Ansicht wie „Editing“, ohne Krileo-Login). Mit ihrer E-Mail unten bekommt sie
            Zugriff auf den Drive-Ordner zum Runterladen der Rohvideos.
          </p>
        </Glass>
      )}

      {client && (
        <Glass>
          <h2 className="mb-2 font-medium">Grundeinstellungen</h2>
          <ActionForm action={updateClientSettings} success="Gespeichert" className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="client_id" value={client.id} />
            <L label="Instagram-Name">
              <input name="ig_username" defaultValue={client.ig_username ?? ""} className={inputCls} />
            </L>
            <L label="E-Mail der VA (Drive-Zugriff)">
              <input name="va_email" type="email" defaultValue={client.va_email ?? ""} className={inputCls} />
            </L>
            <L label="Reel-Uhrzeit">
              <input name="reel_time" type="time" defaultValue={client.reel_time} className={inputCls} />
            </L>
            <L label="Story-Uhrzeit">
              <input name="story_time" type="time" defaultValue={client.story_time} className={inputCls} />
            </L>
            <L label="Drehen … Tage vor dem Posten">
              <input name="shoot_lead_days" type="number" min={0} max={14} defaultValue={client.shoot_lead_days} className={inputCls} />
            </L>
            <L label="Deine WhatsApp-Nummer (für „Fragen?“)">
              <input name="coordinator_phone" defaultValue={client.coordinator_phone ?? ""} placeholder="49171…" className={inputCls} />
            </L>
            <div>
              <Button size="sm">Speichern</Button>
            </div>
          </ActionForm>
        </Glass>
      )}

      <Glass className="space-y-2 lg:col-span-2">
        <h2 className="font-medium">Timer · automatisch posten</h2>
        <p className="text-sm text-muted-foreground">
          Alle 5 Minuten ruft die Datenbank <code>/api/cron/content-publish</code> auf: Eingeplantes wird gepostet, Zahlen
          aktualisiert, Tokens verlängert, morgens Research gescrapt. Einmalig im Supabase SQL-Editor ausführen (pg_cron und pg_net
          aktivieren, <code>&lt;CRON_SECRET&gt;</code> ersetzen):
        </p>
        <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs">{cronSql}</pre>
        <p className="text-xs text-muted-foreground">CRON_SECRET ist {process.env.CRON_SECRET ? "gesetzt ✓" : "NICHT gesetzt"}.</p>
      </Glass>

      <Glass className="space-y-2">
        <h2 className="font-medium">{clientsCount ? "Weiteren Social-Media-Kunden anlegen" : "Ersten Kunden anlegen"}</h2>
        <ActionForm action={createContentClient} className="flex gap-2">
          <input name="name" placeholder="z. B. Balance Oase" className={inputCls} />
          <Button size="sm">Anlegen</Button>
        </ActionForm>
      </Glass>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
