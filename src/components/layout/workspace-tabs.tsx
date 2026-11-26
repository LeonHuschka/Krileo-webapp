"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Globe, Clapperboard } from "lucide-react";
import { WORKSPACES, workspaceFor } from "@/components/layout/workspaces";

const ICONS = { agency: Building2, website: Globe, social: Clapperboard } as const;

/** Floating pills for the three workspaces; the active one glows in its colour. */
export function WorkspaceTabs() {
  const pathname = usePathname();
  const current = workspaceFor(pathname).key;
  return (
    <nav className="flex gap-1.5 overflow-x-auto rounded-full border border-white/5 bg-white/[0.03] p-1 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]">
      {WORKSPACES.map((ws) => {
        const Icon = ICONS[ws.key];
        const active = ws.key === current;
        return (
          <Link
            key={ws.key}
            href={ws.home}
            className="flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all"
            style={
              active
                ? {
                    background: `linear-gradient(135deg, hsl(${ws.hsl} / 0.95), hsl(${ws.hsl} / 0.65))`,
                    color: "white",
                    boxShadow: `0 6px 24px -6px hsl(${ws.hsl} / 0.8)`,
                  }
                : { color: `hsl(${ws.hsl} / 0.85)` }
            }
          >
            <Icon className="h-4 w-4" />
            <span className="whitespace-nowrap">{ws.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
