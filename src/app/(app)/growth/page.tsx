import { createClient } from "@/lib/supabase/server";
import { GrowthKanban } from "@/components/growth/growth-kanban";
import { CreateGrowthTaskDialog } from "@/components/growth/create-growth-task-dialog";

export const dynamic = "force-dynamic";

export default async function GrowthPage() {
  const supabase = await createClient();
  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase
      .from("growth_tasks")
      .select("*")
      .order("position", { ascending: true }),
    supabase.from("user_profiles").select("*").order("full_name"),
  ]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Growth
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agentur-übergreifende Tasks — unabhängig von Aufträgen
          </p>
        </div>
        <CreateGrowthTaskDialog members={members ?? []} />
      </div>
      <GrowthKanban tasks={tasks ?? []} members={members ?? []} />
    </div>
  );
}
