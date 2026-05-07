import { createClient } from "@/lib/supabase/server";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Kontakte
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acquisition & Lead-Pipeline für Krileo
          </p>
        </div>
        <CreateContactDialog />
      </div>
      <ContactsTable contacts={contacts ?? []} />
    </div>
  );
}
