import "server-only";

// Pull the live deployment status of an order's work link from the agency's
// Vercel team (Kristian's — slug "dura2507s-projects"). Matches the work URL's
// host against each project's production domains, then reads the latest
// production deployment. Every failure path returns null so the order page
// degrades gracefully (feature simply hidden) when the token/env is missing.

const API = "https://api.vercel.com";

export type DeploymentState =
  | "READY"
  | "BUILDING"
  | "INITIALIZING"
  | "QUEUED"
  | "ERROR"
  | "CANCELED"
  | "UNKNOWN";

export type DeploymentStatus = {
  projectName: string;
  state: DeploymentState;
  createdAt: number | null;
  commitMessage: string | null;
  inspectorUrl: string | null;
  productionUrl: string | null;
};

let cachedTeamId: string | null = null;
// Small in-memory cache of the project list to avoid refetching all projects on
// every order open. Per server instance, short TTL.
let projectCache: { at: number; projects: VercelProject[] } | null = null;
const PROJECT_TTL_MS = 60_000;

type VercelProject = {
  id: string;
  name: string;
  targets?: { production?: { alias?: string[] } };
};

async function vfetch<T>(path: string): Promise<T | null> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;
  try {
    const r = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function getTeamId(): Promise<string | null> {
  if (process.env.VERCEL_TEAM_ID) return process.env.VERCEL_TEAM_ID;
  if (cachedTeamId) return cachedTeamId;
  const j = await vfetch<{ teams?: { id: string; slug?: string }[] }>("/v2/teams");
  const teams = j?.teams ?? [];
  const team = teams.find((t) => (t.slug ?? "").includes("dura2507")) ?? teams[0];
  cachedTeamId = team?.id ?? null;
  return cachedTeamId;
}

function normHost(input: string): string | null {
  try {
    const u = new URL(input.includes("://") ? input : `https://${input}`);
    return u.host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function getProjects(teamId: string): Promise<VercelProject[]> {
  const now = Date.now();
  if (projectCache && now - projectCache.at < PROJECT_TTL_MS) {
    return projectCache.projects;
  }
  const j = await vfetch<{ projects?: VercelProject[] }>(
    `/v9/projects?teamId=${teamId}&limit=100`,
  );
  const projects = j?.projects ?? [];
  if (projects.length > 0) projectCache = { at: now, projects };
  return projects;
}

/** Pick the nicest production domain: custom domain first, then a clean
 *  *.vercel.app, then whatever's left. */
function bestProductionUrl(aliases: string[]): string | null {
  const clean = aliases.filter((a) => !a.includes("-dura2507"));
  const custom = clean.find((a) => !a.endsWith(".vercel.app"));
  const vercel = clean.find((a) => a.endsWith(".vercel.app"));
  const pick = custom ?? vercel ?? aliases[0] ?? null;
  return pick ? `https://${pick}` : null;
}

function matchProject(
  projects: VercelProject[],
  host: string,
): VercelProject | undefined {
  return projects.find((p) =>
    (p.targets?.production?.alias ?? []).some(
      (a) => String(a).replace(/^www\./, "").toLowerCase() === host,
    ),
  );
}

async function buildStatus(
  teamId: string,
  match: VercelProject,
): Promise<DeploymentStatus> {
  const productionUrl = bestProductionUrl(match.targets?.production?.alias ?? []);
  const dep = await vfetch<{
    deployments?: {
      state?: string;
      readyState?: string;
      created?: number;
      createdAt?: number;
      inspectorUrl?: string;
      meta?: Record<string, string>;
    }[];
  }>(`/v6/deployments?teamId=${teamId}&projectId=${match.id}&target=production&limit=1`);

  const d = dep?.deployments?.[0];
  const rawState = (d?.state ?? d?.readyState ?? "UNKNOWN").toUpperCase();
  const VALID: readonly string[] = [
    "READY",
    "BUILDING",
    "INITIALIZING",
    "QUEUED",
    "ERROR",
    "CANCELED",
  ];
  const state: DeploymentState = VALID.includes(rawState)
    ? (rawState as DeploymentState)
    : "UNKNOWN";

  return {
    projectName: match.name,
    state,
    createdAt: d?.created ?? d?.createdAt ?? null,
    commitMessage:
      d?.meta?.githubCommitMessage ??
      d?.meta?.gitlabCommitMessage ??
      d?.meta?.bitbucketCommitMessage ??
      null,
    inspectorUrl: d?.inspectorUrl ?? null,
    productionUrl,
  };
}

export async function getDeploymentStatusForUrl(
  workUrl: string | null,
): Promise<DeploymentStatus | null> {
  if (!workUrl) return null;
  const host = normHost(workUrl);
  if (!host) return null;
  const teamId = await getTeamId();
  if (!teamId) return null;
  const match = matchProject(await getProjects(teamId), host);
  if (!match) return null;
  return buildStatus(teamId, match);
}

/**
 * Batch variant for the board: fetches the project list once, then resolves the
 * latest deployment per work URL in parallel. Returns a Map keyed by the exact
 * input URL. Missing token / no match → the URL is simply absent from the Map.
 */
export async function getDeploymentStatusesForUrls(
  workUrls: (string | null | undefined)[],
): Promise<Map<string, DeploymentStatus>> {
  const out = new Map<string, DeploymentStatus>();
  const urls = Array.from(new Set(workUrls.filter((u): u is string => !!u)));
  if (urls.length === 0) return out;

  const teamId = await getTeamId();
  if (!teamId) return out;
  const projects = await getProjects(teamId);

  await Promise.all(
    urls.map(async (url) => {
      const host = normHost(url);
      if (!host) return;
      const match = matchProject(projects, host);
      if (!match) return;
      try {
        out.set(url, await buildStatus(teamId, match));
      } catch {
        /* skip this one */
      }
    }),
  );
  return out;
}
