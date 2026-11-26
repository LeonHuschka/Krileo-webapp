"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSocialClient } from "@/app/(app)/social/client-actions";

export type SocialClientOption = { slug: string; name: string };

/** Dropdown of the social-media clients Krileo looks after. Choice is kept in a cookie. */
export function ClientSwitcher({ clients, current }: { clients: SocialClientOption[]; current: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!clients.length) {
    return <p className="text-xs text-muted-foreground">Noch kein Kunde angelegt</p>;
  }
  return (
    <select
      value={current ?? clients[0].slug}
      disabled={pending}
      onChange={(e) => {
        const slug = e.target.value;
        start(async () => {
          await setSocialClient(slug);
          router.refresh();
        });
      }}
      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-violet-400/60"
    >
      {clients.map((c) => (
        <option key={c.slug} value={c.slug}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
