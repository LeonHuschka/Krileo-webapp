import { createClient } from "@/lib/supabase/server";
import { OrdersKanban } from "@/components/orders/kanban-board";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aufträge</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alle Krileo-Aufträge auf einem Board
          </p>
        </div>
        <CreateOrderDialog
          contacts={contacts ?? []}
          members={members ?? []}
        />
      </div>
      <OrdersKanban orders={orders ?? []} members={members ?? []} />
    </div>
  );
}
