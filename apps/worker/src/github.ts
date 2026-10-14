import { App } from 'octokit';
import { readFileSync } from 'node:fs';
import {cleanLog} from './logs.js';

let ghApp: App | undefined;

function getApp(): App {
  if (ghApp) return ghApp;  

  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error('GITHUB_APP_ID is not set');

  const keyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
  const privateKey =
    process.env.GITHUB_PRIVATE_KEY ?? (keyPath ? readFileSync(keyPath, 'utf8') : undefined);
  if (!privateKey) throw new Error('Set GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH');

  ghApp = new App({ appId: Number(appId), privateKey });
  return ghApp;
}

export async function getRepoClient(installationId: number) {
  return getApp().getInstallationOctokit(installationId);
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

  const fullDiff = String(diffData ?? '');
  const diffLines = fullDiff.split('\n');
  const maxDiffLines = 300;

  const truncated = diffLines.length > maxDiffLines;

  const visibleDiff = diffLines
    .slice(0, maxDiffLines)
    .join('\n');

  // Extract filenames from the diff headers.
  const changedFiles = [
    ...new Set(
      fullDiff
        .split('\n')
        .filter((line) => line.startsWith('diff --git '))
        .map((line) => line.split(' b/').pop()!)
        .filter((path) => path !== '/dev/null'),
    ),
  ];

  const truncationNote = truncated
    ? `[diff truncated: showing ${maxDiffLines} of ${diffLines.length} lines]`
    : '';

  const changedFilesNote =
    `[files changed in this commit: ${
      changedFiles.length > 0 ? changedFiles.join(', ') : 'none detected'
    }]`;

  const diff = [
    visibleDiff,
    truncationNote,
    changedFilesNote,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    failedJobs: failedJobContext,
    diff,
  };
}