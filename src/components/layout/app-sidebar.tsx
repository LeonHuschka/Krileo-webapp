"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserProfileRow } from "@/lib/types/database";
import { isActive, workspaceFor } from "@/components/layout/workspaces";
import { ClientSwitcher, type SocialClientOption } from "@/components/layout/client-switcher";

/** Floating sidebar of the active workspace, tinted in its colour. */
export function AppSidebar({
  user,
  socialClients,
  socialClient,
}: {
  user: UserProfileRow;
  socialClients: SocialClientOption[];
  socialClient: string | null;
}) {
  const pathname = usePathname();
  const ws = workspaceFor(pathname);
  const accent = `hsl(${ws.hsl})`;

  return (
    <aside className="hidden w-60 shrink-0 px-3 pb-3 md:block">
      <div
        className="sticky top-[4.25rem] flex h-[calc(100vh-5rem)] flex-col overflow-hidden rounded-2xl border bg-sidebar/80 backdrop-blur"
        style={{ borderColor: `hsl(${ws.hsl} / 0.25)`, boxShadow: `0 12px 40px -20px hsl(${ws.hsl} / 0.55)` }}
      >
        <div className="relative px-4 pb-3 pt-4">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `linear-gradient(160deg, hsl(${ws.hsl} / 0.18), transparent 70%)` }}
          />
          <div className="relative text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
            {ws.label}
          </div>
          {ws.key === "social" && (
            <div className="relative mt-3">
              <ClientSwitcher clients={socialClients} current={socialClient} />
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {ws.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "font-medium text-white" : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground",
                )}
                style={active ? { background: `hsl(${ws.hsl} / 0.22)` } : undefined}
              >
                <Icon className="h-4 w-4" style={active ? { color: accent } : undefined} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/5 px-4 py-3 text-xs text-sidebar-foreground/60">
          Eingeloggt als <span className="font-medium text-sidebar-foreground">{user.full_name || "Du"}</span>
          <div className="mt-0.5 capitalize">Rolle: {user.role}</div>
        </div>
      </div>
    </aside>
  );
}
