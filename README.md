# Krileo Webapp

Internes Tracking-Tool für die Krileo-Agency: Auftrags-Pipeline, To-Dos, Team-Zuweisung und Acquisition-Kontakte.

## Stack

- **Next.js 14** App Router · TypeScript · Tailwind · shadcn/ui (new-york / zinc)
- **Supabase** (Postgres + Auth + RLS) via `@supabase/ssr`
- **react-hook-form** + **zod** für Formulare
- **@dnd-kit** für das Auftrags-Kanban
- Forced Dark Mode

## Setup

```bash
bun install
cp .env.local.example .env.local
# .env.local mit Supabase-URL und Publishable Key füllen

# Supabase lokal starten (optional)
supabase start
supabase db reset    # läd alle Migrations
```

Dev-Server:

```bash
bun run dev
# http://localhost:3000
```

Production-Build:

```bash
bun run build
bun run start
```

## Features

- **Aufträge** — Kanban (Lead → Angebot → Aktiv → Review → Geliefert → Archiv) mit Drag-&-Drop, Detail-View mit Inline-Edit
- **To-Dos pro Auftrag** — Checkbox, Fälligkeitsdatum, Verantwortlicher
- **Kontakte** — Tabelle mit Suche, Status-Filter, Tag-Filter, Detail-View, "Letzter Kontakt"-Button
- **Dashboard** — KPI-Cards, Pipeline-Bar, Acquisition-Status, meine offenen To-Dos
- **Team** — Mitglieder-Liste, Rollen-Verwaltung (nur Owner)
- **Settings** — Profilverwaltung
- **Auth** — E-Mail/Passwort + Magic Link, erste Registrierung wird Owner

## Datenmodell

| Tabelle | Zweck |
|---|---|
| `user_profiles` | Team-Mitglieder mit Rolle (`owner`/`admin`/`member`) |
| `orders` | Aufträge mit Status, Priorität, Wert, Verantwortlichem |
| `order_todos` | To-Dos pro Auftrag |
| `contacts` | Acquisition-Kontakte mit Status & Tags |
| `activity_log` | Audit-Trail |

Migrations in `supabase/migrations/`. RLS: alle authentifizierten Nutzer lesen alles, Schreibrechte je nach Rolle.

## Verzeichnisstruktur

```
src/
  app/(auth)/         # Login + Signup
  app/(app)/          # Geschütztes App-Shell
    page.tsx          # Dashboard
    orders/           # Kanban + Detail
    contacts/         # Tabelle + Detail
    team/, settings/
  components/
    ui/               # shadcn
    auth/, layout/, orders/, contacts/, team/, settings/
  lib/
    supabase/         # client.ts, server.ts, middleware.ts
    types/database.ts # TypeScript-Schema (kann mit `supabase gen types` ersetzt werden)
    validations/      # Zod-Schemas
    constants.ts      # Status-Labels, Farben
supabase/migrations/  # SQL-Migrationen
```

## Deployment

- Vercel + Supabase
- Env-Vars setzen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
