"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Target,
  Sparkles,
  Wrench,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Start", icon: LayoutDashboard },
  { href: "/akquise", label: "Akquise", icon: Target },
  { href: "/orders", label: "Aufträge", icon: ClipboardList },
  { href: "/growth", label: "Growth", icon: Sparkles },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/settings", label: "Mehr", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-background md:hidden">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
