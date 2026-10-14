import { fetchFailureContext, getRepoClient } from "./github.js";
import type { TriageJob } from "./types/TriageJob.js";
import { READ_FILE_TOOL } from "./readFile.js";
import { readRepoFile } from "./tools.js";

const OWNER = "Neeraaaj";
const REPO = 'triage-demo';

export async function loadCase(runId: number){
    const installationId = Number(process.env.GITHUB_INSTALLATION_ID);
    if(!installationId) throw new Error("GITHUB_INSTALLATION_ID is not set");

    const octokit = await getRepoClient(installationId);
    const { data: run } = await octokit.rest.actions.getWorkflowRun({
        owner: OWNER,
        repo: REPO,
        run_id: runId
    });

    const job: TriageJob = {
        deliveryId: `replay-${runId}`,
        installationId,
        repo: `${OWNER}/${REPO}`,
        runId,
        headSha: run.head_sha,
        prNumbers: run.pull_requests?.map((p) => p.number) ?? [],
    };

    const ctx = await fetchFailureContext(octokit, job);
    const readFile = (path: string) =>
        readRepoFile(octokit, OWNER, REPO, run.head_sha, path);

    return { ctx, readFile };
}