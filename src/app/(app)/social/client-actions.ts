"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/content/db";
import { SOCIAL_CLIENT_COOKIE } from "@/lib/content/social";

export async function setSocialClient(slug: string): Promise<void> {
  await requireAdmin();
  cookies().set(SOCIAL_CLIENT_COOKIE, slug.slice(0, 80), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/social", "layout");
}
