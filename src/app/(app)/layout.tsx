import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

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

  return (
    <div className="flex min-h-screen">
      <AppSidebar user={profile} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={profile} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
