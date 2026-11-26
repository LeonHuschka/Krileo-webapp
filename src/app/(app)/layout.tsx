import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { currentClient } from "@/lib/content/social";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Social-media clients for the dropdown in the Social Media workspace.
  const { client, clients } = await currentClient().catch(() => ({ client: null, clients: [] }));

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar user={profile} />
      <div className="flex min-w-0 flex-1">
        <AppSidebar
          user={profile}
          socialClients={clients.map((c) => ({ slug: c.slug, name: c.name }))}
          socialClient={client?.slug ?? null}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
