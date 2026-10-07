import { getRepoClient, fetchFailureContext } from './github.js';
import type { TriageJob } from './types/TriageJob.js';   // ← adjust to your file name

const runId = Number(process.argv[2]);
if (!runId) throw new Error('usage: tsx src/inspect.ts <runId>');

const installationId = Number(process.env.GITHUB_INSTALLATION_ID);
if (!installationId) throw new Error('GITHUB_INSTALLATION_ID is not set');

const [owner, repo] = ['Neeraaaj', 'triage-demo'];

const octokit = await getRepoClient(installationId);
const { data: run } = await octokit.rest.actions.getWorkflowRun({ owner, repo, run_id: runId });

const job: TriageJob = {
  deliveryId: 'cli',
  installationId,
  repo: `${owner}/${repo}`,
  runId,
  headSha: run.head_sha,
  prNumbers: run.pull_requests?.map((p) => p.number) ?? [],
};

const ctx = await fetchFailureContext(octokit, job);

for (const j of ctx.failedJobs) {
  console.log(`\n===== job: ${j.name} | failed step: ${j.failedStep} =====`);
  console.log(j.logTail);
}
console.log(`\n===== diff (${ctx.diff.split('\n').length} lines) =====`);
console.log(ctx.diff);