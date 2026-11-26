import {
  Archive,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Receipt,
  Scissors,
  Send,
  Settings,
  Sparkles,
  Target,
  Telescope,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * The three workspaces of the app, picked with the floating tabs in the
 * top bar. Each has its own colour (blue family + violet, matching the
 * Krileo brand) and its own sidebar.
 */
export type WorkspaceKey = "agency" | "website" | "social";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export type Workspace = {
  key: WorkspaceKey;
  label: string;
  /** HSL triplet, used as hsl(var) for accents and glow */
  hsl: string;
  home: string;
  items: NavItem[];
};

export const WORKSPACES: Workspace[] = [
  {
    key: "agency",
    label: "Krileo Agency",
    hsl: "207 100% 58%",
    home: "/",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/growth", label: "Growth", icon: Sparkles },
      { href: "/akquise", label: "Akquise", icon: Target },
      { href: "/contacts", label: "Kontakte", icon: Users },
      { href: "/buchhaltung", label: "Buchhaltung", icon: Receipt },
      { href: "/tools", label: "Tools", icon: Wrench },
      { href: "/team", label: "Team", icon: UserCog },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    key: "website",
    label: "Websites",
    hsl: "232 90% 66%",
    home: "/orders",
    items: [{ href: "/orders", label: "Aufträge", icon: ClipboardList }],
  },
  {
    key: "social",
    label: "Social Media",
    hsl: "272 85% 66%",
    home: "/social",
    items: [
      { href: "/social", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/social/research", label: "Research", icon: Telescope },
      { href: "/social/planung", label: "Wochenplanung", icon: CalendarDays },
      { href: "/social/editing", label: "Editing", icon: Scissors },
      { href: "/social/vault", label: "Vault", icon: Archive },
      { href: "/social/posting", label: "Posting", icon: Send },
      { href: "/social/einstellungen", label: "Einstellungen", icon: Settings },
    ],
  },
];

export function workspaceFor(pathname: string): Workspace {
  if (pathname.startsWith("/social") || pathname.startsWith("/content")) return WORKSPACES[2];
  if (pathname.startsWith("/orders")) return WORKSPACES[1];
  return WORKSPACES[0];
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
