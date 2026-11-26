"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, workspaceFor } from "@/components/layout/workspaces";

/** Phone: the items of the current workspace (switch workspace with the pills on top). */
export function MobileBottomNav() {
  const pathname = usePathname();
  const ws = workspaceFor(pathname);
  const items = ws.items.slice(0, 6);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground"
            style={active ? { color: `hsl(${ws.hsl})` } : undefined}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
