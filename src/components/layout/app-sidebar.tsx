"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  UserCog,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import type { UserProfileRow } from "@/lib/types/database";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Aufträge", icon: ClipboardList },
  { href: "/contacts", label: "Kontakte", icon: Users },
  { href: "/team", label: "Team", icon: UserCog },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ user }: { user: UserProfileRow }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      <div className="relative flex h-16 items-center gap-3 overflow-hidden border-b border-sidebar-border px-5">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent" />
        <Image
          src="/krileo-icon.png"
          alt={APP_NAME}
          width={36}
          height={36}
          className="relative h-9 w-9 drop-shadow-[0_0_12px_hsl(207_100%_60%/0.4)]"
          priority
        />
        <div className="relative">
          <div className="font-semibold leading-tight tracking-tight text-sidebar-foreground">
            {APP_NAME}
          </div>
          <div className="text-xs text-sidebar-foreground/60">Agency</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/60">
        Eingeloggt als{" "}
        <span className="font-medium text-sidebar-foreground">
          {user.full_name || "Du"}
        </span>
        <div className="mt-0.5 capitalize">Rolle: {user.role}</div>
      </div>
    </aside>
  );
}
