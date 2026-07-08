import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDeploymentStatusForUrl } from "@/lib/orders/vercel";
import {
  OrderDetail,
  statusToTab,
  type OrderTabKey,
} from "@/components/orders/order-detail";

export const dynamic = "force-dynamic";

const TAB_KEYS: OrderTabKey[] = [
  "auftrag",
  "aktiv",
  "review",
  "geliefert",
  "archiv",
];

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
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

  // Live deployment status from Vercel (matched via the order's work link).
  const deployment = await getDeploymentStatusForUrl(order.work_url).catch(
    () => null,
  );

  // Open the tab matching the order's status, unless the URL pins one.
  const urlTab = searchParams.tab as OrderTabKey | undefined;
  const defaultTab =
    urlTab && TAB_KEYS.includes(urlTab) ? urlTab : statusToTab(order.status);

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
        deployment={deployment}
        todos={todos ?? []}
        defaultTab={defaultTab}
      />
    </div>
  );
}
