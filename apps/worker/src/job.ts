import { getRepoClient } from "./github.js";
import { fetchFailureContext } from "./github.js";
import type { TriageJob } from "./types/TriageJob.js";
import { checkEvidence } from "./verify.js";
import { renderComment } from "./comment.js";
import { upsertComment } from "./post.js";
import { triage } from "./agent.js";

export async function handleJob(job: TriageJob) {
    const octokit = await getRepoClient(job.installationId);
    const ctx = await fetchFailureContext(octokit, job);

    if(ctx.failedJobs.length === 0){
        console.log({
            msg: "no failed jobs",
            runId: job.runId
        });
        return;
    }

    const t0 = Date.now();
    const { result, usage } = await triage(ctx);
    const evidence = checkEvidence(result, ctx);


    console.log({
        msg: 'triaged',
        deliveryId: job.deliveryId,
        repo: job.repo,
        runId: job.runId,
        prNumbers: job.prNumbers,
        summary: result.summary,
        confidence: result.confidence,
        evidenceOk: evidence.ok,
        missingQuotes: evidence.missing,
        ms: Date.now() - t0,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
    });

    const body = renderComment(result, evidence, job.runId);
    const posted = await upsertComment(octokit, job, body);
    console.log({ msg: 'comment', runId: job.runId, ...posted });
    return { result, evidence, octokit };  
}