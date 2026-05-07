import { createClient } from "@/lib/supabase/server";
import { MembersTable } from "@/components/team/members-table";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: members }, { data: me }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user!.id)
      .single(),
  ]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Krileo Team-Mitglieder & Rollen
        </p>
      </div>
      <MembersTable
        members={members ?? []}
        canEdit={me?.role === "owner"}
        currentUserId={user!.id}
      />
      <p className="text-xs text-muted-foreground">
        Neue Mitglieder kommen über Signup dazu. Der erste registrierte User
        wird automatisch Owner.
      </p>
    </div>
  );
}
