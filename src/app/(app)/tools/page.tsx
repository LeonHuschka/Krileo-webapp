import { createClient } from "@/lib/supabase/server";
import { CreateToolDialog } from "@/components/tools/create-tool-dialog";
import { ToolsGrid } from "@/components/tools/tools-grid";
import { TOOL_CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const supabase = await createClient();
  const { data: tools } = await supabase
    .from("tools")
    .select("*")
    .order("name", { ascending: true });

  const predefined = new Set<string>(TOOL_CATEGORIES);
  const extraCategories = Array.from(
    new Set(
      (tools ?? [])
        .map((t) => t.category)
        .filter((c): c is string => !!c && !predefined.has(c)),
    ),
  ).sort();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Tools
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schnellzugriff auf alle Tools mit Login-Daten zum Kopieren
          </p>
        </div>
        <CreateToolDialog extraCategories={extraCategories} />
      </div>
      <ToolsGrid tools={tools ?? []} extraCategories={extraCategories} />
    </div>
  );
}
