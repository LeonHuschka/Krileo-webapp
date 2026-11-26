import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ContentStatus } from "@/lib/content/types";
import { STATUS_LABEL } from "@/lib/content/types";

/** Violet of the Social Media workspace. */
export const SOCIAL_HSL = "272 85% 66%";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Floating glass panel, the basic surface of the Social Media workspace. */
export function Glass({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "glass-card rounded-2xl p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Pill tabs (Duraska style) driven by a query parameter. */
export function PillTabs({
  tabs,
  current,
}: {
  tabs: { href: string; label: string; key: string; count?: number }[];
  current: string;
}) {
  return (
    <div className="glass-pill inline-flex flex-wrap gap-1 rounded-full p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm transition-colors",
            current === t.key ? "glass-pill-active" : "text-white/75 hover:bg-white/15",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 opacity-60">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

const STATUS_CLASS: Record<ContentStatus, string> = {
  geplant: "bg-zinc-600/70 text-zinc-50",
  gedreht: "bg-sky-700/80 text-sky-50",
  freigabe: "bg-amber-600/90 text-amber-50",
  eingeplant: "bg-violet-600/80 text-violet-50",
  veroeffentlicht: "bg-emerald-600 text-white",
  fehler: "bg-red-700 text-white",
};

export const STATUS_DOT: Record<ContentStatus, string> = {
  geplant: "bg-zinc-400",
  gedreht: "bg-sky-400",
  freigabe: "bg-amber-400",
  eingeplant: "bg-violet-400",
  veroeffentlicht: "bg-emerald-400",
  fehler: "bg-red-500",
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}K`;
  return String(n);
}

export const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50";

export function NoClient() {
  return (
    <Glass>
      <p className="text-sm text-muted-foreground">
        Noch kein Social-Media-Kunde angelegt – unter{" "}
        <Link href="/social/einstellungen" className="underline">
          Einstellungen
        </Link>{" "}
        anlegen.
      </p>
    </Glass>
  );
}

/** Colour of an AI score badge. */
export function scoreTone(score: number | null) {
  if (score === null) return "bg-zinc-600/80";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-lime-500/90";
  if (score >= 45) return "bg-amber-500";
  return "bg-zinc-600";
}

