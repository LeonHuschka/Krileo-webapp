import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContactDetail } from "@/components/contacts/contact-detail";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUSES, ORDER_STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const [{ data: contact }, { data: orders }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("orders")
      .select("*")
      .eq("contact_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Zurück zu Kontakten
      </Link>

      <ContactDetail contact={contact} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verknüpfte Aufträge</CardTitle>
        </CardHeader>
        <CardContent>
          {(orders ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Aufträge mit diesem Kontakt verknüpft.
            </p>
          ) : (
            <ul className="space-y-2">
              {(orders ?? []).map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-3"
                >
                  <Link
                    href={`/orders/${o.id}`}
                    className="font-medium hover:underline"
                  >
                    {o.title}
                  </Link>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border capitalize",
                      ORDER_STATUS_COLORS[o.status],
                    )}
                  >
                    {ORDER_STATUSES.find((s) => s.value === o.status)?.label}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
