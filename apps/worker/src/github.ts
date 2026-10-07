import { App } from 'octokit';
import { readFileSync } from 'node:fs';
import {cleanLog} from './logs.js';

const ghApp = new App({
  appId: parseInt(process.env.GITHUB_APP_ID!, 10),
  privateKey: readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH!, 'utf8'),
});

export async function getRepoClient(installationId: number) {
  return ghApp.getInstallationOctokit(installationId);
}

export async function fetchFailureContext(octokit: any, job: any) {
  const [owner, repo] = String(job.repo ?? '').split('/');
  const runId = job.run_id ?? job.runId;
  const headSha = job.head_sha ?? job.headSha;

  const { data: runJobs } = await octokit.rest.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: runId,
  });

  const failedJobs = (runJobs?.jobs ?? []).filter(
    (candidate: any) => candidate.conclusion === 'failure',
  );

  const failedJobContext = [] as Array<{ name: string; failedStep: string | null; logTail: string }>;

  for (const failedJob of failedJobs) {
    const failedStep = failedJob.steps?.find(
      (step: any) => step.conclusion === 'failure',
    )?.name ?? null;

    const { data: logData } = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
      owner,
      repo,
      job_id: failedJob.id,
    });

    const logTail = cleanLog(String(logData ?? ''));

    console.log({ msg: 'log cleaned', rawLines: String(logData).split('\n').length, cleanLines: logTail.split('\n').length });

    failedJobContext.push({
      name: failedJob.name,
      failedStep,
      logTail,
    });
  }

  const { data: diffData } = await octokit.rest.repos.getCommit({
    owner,
    repo,
    ref: headSha,
    mediaType: { format: 'diff' },
  });

  const diff = String(diffData ?? '')
    .split('\n')
    .slice(0, 300)
    .join('\n');

  return {
    failedJobs: failedJobContext,
    diff,
  };
}
