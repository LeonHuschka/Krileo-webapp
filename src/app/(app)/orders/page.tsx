import { createClient } from "@/lib/supabase/server";
import { OrdersKanban } from "@/components/orders/kanban-board";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
import { getDeploymentStatusesForUrls } from "@/lib/orders/vercel";
import type { CardDeployment } from "@/components/orders/order-card";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();

  const [{ data: orders }, { data: members }, { data: contacts }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .order("position", { ascending: true }),
      supabase.from("user_profiles").select("*").order("full_name"),
      supabase.from("contacts").select("*").order("name"),
    ]);

  const orderList = orders ?? [];

  // Live deployment status per card (last-change time / building state).
  const deployStatuses = await getDeploymentStatusesForUrls(
    orderList.map((o) => o.work_url),
  ).catch(() => new Map());
  const deployMap: Record<string, CardDeployment> = {};
  for (const o of orderList) {
    const s = o.work_url ? deployStatuses.get(o.work_url) : undefined;
    if (s) deployMap[o.id] = { state: s.state, createdAt: s.createdAt };
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Aufträge
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alle Krileo-Aufträge auf einem Board
          </p>
        </div>
        <CreateOrderDialog
          contacts={contacts ?? []}
          members={members ?? []}
        />
      </div>
      <OrdersKanban
        orders={orderList}
        members={members ?? []}
        deployMap={deployMap}
      />
    </div>
  );
}
