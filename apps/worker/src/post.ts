import { markerFor } from './comment.js';
import type { TriageJob } from './types/TriageJob.js';
import type { getRepoClient } from './github.js';

type RepoClient = Awaited<ReturnType<typeof getRepoClient>>;

export async function upsertComment(octokit: RepoClient, job: TriageJob, body: string) {
  if (job.prNumbers.length === 0) {
    return { action: 'skipped' as const, reason: 'no PR' };
  }

  const [owner, repo] = job.repo.split('/');
  const issue_number = job.prNumbers[0];
  const marker = markerFor(job.runId);

  // 1. Get ALL comments on the PR (there may be more than one page)
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner, repo, issue_number, per_page: 100,
  });

  const existing = comments.find((comment) => comment?.body?.includes(marker))
  // 2. TODO: find the comment whose body includes `marker`
  //    hint: comments.find((c) => c.body?.includes(marker))

  if(existing){
    await octokit.rest.issues.updateComment(
        { 
            owner, 
            repo, 
            comment_id: existing.id, 
            body 
        }
    );

    return {action: 'updated' as const, url: existing.html_url};
  }else{
    const {data} = await octokit.rest.issues.createComment(
        {
            owner,
            repo,
            issue_number,
            body
        }
    );

    return {action: 'created' as const, url: data.html_url}
  }
}