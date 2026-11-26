import { EditingBoard } from "@/components/content/editing-board";
import { loadJobs } from "@/lib/content/editing";
import { currentClient } from "@/lib/content/social";
import { NoClient, PageHeader } from "../shared";

export const dynamic = "force-dynamic";

export default async function EditingPage() {
  const { client } = await currentClient();
  if (!client) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader title="Editing" />
        <NoClient />
      </div>
    );
  }
  const jobs = await loadJobs(client.id, ["gedreht", "freigabe", "eingeplant", "veroeffentlicht"]);
  return (
    <div className="p-4 md:p-6">
      <EditingBoard jobs={jobs} lang="de" hrefBase="/social/video/" />
    </div>
  );
}
