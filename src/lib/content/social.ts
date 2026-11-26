import "server-only";

import { cookies } from "next/headers";
import { listClients } from "@/lib/content/db";
import type { ContentClient } from "@/lib/content/types";

export const SOCIAL_CLIENT_COOKIE = "social_client";

/** The social-media client picked in the sidebar dropdown (cookie), else the first one. */
export async function currentClient(): Promise<{ client: ContentClient | null; clients: ContentClient[] }> {
  const clients = await listClients().catch(() => [] as ContentClient[]);
  const slug = cookies().get(SOCIAL_CLIENT_COOKIE)?.value;
  return { client: clients.find((c) => c.slug === slug) ?? clients[0] ?? null, clients };
}
