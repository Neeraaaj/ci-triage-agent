import { getRepoClient, fetchFailureContext } from './github.js';
import type { TriageJob } from './types/TriageJob.js';
import { checkEvidence } from './verify.js';
import { renderComment } from './comment.js';
import { upsertComment } from './post.js';
import { triage, triageWithTools } from './agent.js';
import { readRepoFile } from './tools.js';
import {startActiveObservation} from '@langfuse/tracing'

export async function handleJob(job: TriageJob) {
    return startActiveObservation('triage', async (root) => {
        root.update({
        input: { repo: job.repo, runId: job.runId, prNumbers: job.prNumbers },
        metadata: { deliveryId: job.deliveryId, agent: process.env.AGENT ?? 'tools' },
        });
        const octokit = await getRepoClient(job.installationId);
        const ctx = await startActiveObservation('fetch-context', async (s) => {
            const c = await fetchFailureContext(octokit, job);
            s.update({ output: { failedJobs: c.failedJobs.length, diffLines: c.diff.split('\n').length } });
            return c;
        });

        // 1. Guard FIRST: no failed jobs → nothing to triage, no API cost
        if (ctx.failedJobs.length === 0) {
            console.log({ msg: 'no failed jobs', runId: job.runId });
            return;
        }

        // 2. Build the file reader (after octokit exists)
        const [owner, repo] = job.repo.split('/');
        const readFile = (path: string) => readRepoFile(octokit, owner, repo, job.headSha, path);

        // 3. Start the timer, then triage (kill switch: AGENT=oneshot rolls back)
        const agent = process.env.AGENT === 'oneshot' ? 'oneshot' : 'tools';
        const t0 = Date.now();
        const out = agent === 'oneshot'
            ? await triage(ctx)
            : await triageWithTools(ctx, { readFile });
        const ms = Date.now() - t0;

        const filesRead = 'filesRead' in out ? out.filesRead : {};
        const toolCalls = 'toolCalls' in out ? out.toolCalls : [];
        const evidence = checkEvidence(out.result, ctx, filesRead);

        console.log({
            msg: 'triaged',
            agent,
            toolCalls,
            deliveryId: job.deliveryId,
            repo: job.repo,
            runId: job.runId,
            prNumbers: job.prNumbers,
            summary: out.result.summary,
            confidence: out.result.confidence,
            evidenceOk: evidence.ok,
            missingQuotes: evidence.missing,
            ms,
            inputTokens: out.usage.input_tokens,
            outputTokens: out.usage.output_tokens,
        });

        const body = renderComment(out.result, evidence, job.runId);
        const posted = await upsertComment(octokit, job, body);
        console.log({ msg: 'comment', runId: job.runId, ...posted });

        root.update({ output: { summary: out.result.summary, confidence: out.result.confidence,
                            evidenceOk: evidence.ok, toolCalls } });
                            
        return { result: out.result, evidence };
    });
}