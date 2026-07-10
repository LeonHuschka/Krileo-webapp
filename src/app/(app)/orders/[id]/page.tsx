import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDeploymentStatusForUrl } from "@/lib/orders/vercel";
import { OrderDetail } from "@/components/orders/order-detail";
import {
  statusToTab,
  ORDER_TAB_KEYS,
  type OrderTabKey,
} from "@/lib/orders/tabs";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const supabase = await createClient();

  const [
    { data: order },
    { data: members },
    { data: contacts },
    { data: events },
    { data: allOrders },
    { data: reviewSuggestions },
  ] = await Promise.all([
    supabase.from("orders").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("user_profiles").select("*").order("full_name"),
    supabase.from("contacts").select("*").order("name"),
    supabase
      .from("order_events")
      .select("*")
      .eq("order_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("created_at, updated_at, status, canceled_at"),
    supabase
      .from("telegram_review_suggestions")
      .select("*")
      .eq("order_id", params.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (!order) notFound();

  // Average project duration (created → last activity) over completed,
  // non-canceled orders — for the "vs. Ø" gauge in the Geliefert tab.
  const completed = (allOrders ?? []).filter(
    (o) =>
      (o.status === "geliefert" || o.status === "archiv") && !o.canceled_at,
  );
  const avgLeadMs = completed.length
    ? completed.reduce(
        (s, o) =>
          s +
          Math.max(
            0,
            new Date(o.updated_at).getTime() - new Date(o.created_at).getTime(),
          ),
        0,
      ) / completed.length
    : 0;

  // Live deployment status from Vercel (matched via the order's work link).
  const deployment = await getDeploymentStatusForUrl(order.work_url).catch(
    () => null,
  );

  // Open the tab matching the order's status, unless the URL pins one.
  const urlTab = searchParams.tab as OrderTabKey | undefined;
  const defaultTab =
    urlTab && ORDER_TAB_KEYS.includes(urlTab)
      ? urlTab
      : statusToTab(order.status);

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-4 p-4 md:px-8 md:py-6">
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
        deployment={deployment}
        events={events ?? []}
        avgLeadMs={avgLeadMs}
        reviewSuggestions={reviewSuggestions ?? []}
        defaultTab={defaultTab}
      />
    </div>
  );
}
