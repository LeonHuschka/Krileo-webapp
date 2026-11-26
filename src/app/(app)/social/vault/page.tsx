import { VaultGrid } from "@/components/content/vault-grid";
import { loadJobs } from "@/lib/content/editing";
import { currentClient } from "@/lib/content/social";
import { NoClient, PageHeader } from "../shared";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const { client } = await currentClient();
  if (!client) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader title="Content Vault" />
        <NoClient />
      </div>
    );
  }
  const jobs = (await loadJobs(client.id, ["freigabe", "eingeplant", "veroeffentlicht", "fehler"])).filter((j) => j.cutFileId);
  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Content Vault"
        subtitle={`Alle fertigen Schnitte – abspielbar, ladbar, mit Status · ${jobs.length} Videos`}
      />
      <VaultGrid jobs={jobs} />
    </div>
  );
}
