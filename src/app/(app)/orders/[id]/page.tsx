import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrderDetail } from "@/components/orders/order-detail";
import { OrderTodoList } from "@/components/orders/order-todo-list";
import { TechBriefPanel } from "@/components/orders/tech-brief-panel";
import { ReviewPanel } from "@/components/orders/review-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [{ data: order }, { data: todos }, { data: members }, { data: contacts }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", params.id).maybeSingle(),
      supabase
        .from("order_todos")
        .select("*")
        .eq("order_id", params.id)
        .order("position", { ascending: true }),
      supabase.from("user_profiles").select("*").order("full_name"),
      supabase.from("contacts").select("*").order("name"),
    ]);

  if (!order) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Zurück zu Aufträgen
      </Link>

      <OrderDetail
        order={order}
        members={members ?? []}
        contacts={contacts ?? []}
      />

      <TechBriefPanel
        orderId={order.id}
        initialNotes={order.description ?? ""}
        initialBrief={order.tech_brief ?? null}
      />

      <ReviewPanel
        orderId={order.id}
        status={order.status}
        initialReview={order.review ?? null}
        seedMustHaves={order.tech_brief?.must_haves ?? []}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">To-Dos</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTodoList
            orderId={order.id}
            todos={todos ?? []}
            members={members ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
