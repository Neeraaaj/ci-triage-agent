import {SQSClient, ReceiveMessageCommand, DeleteMessageCommand} from '@aws-sdk/client-sqs';
import { getRepoClient, fetchFailureContext } from './github.js';
import {TriageJob} from './types/TriageJob.js';
import { checkEvidence } from './verify.js';
import { triage } from './agent.js';

const QUEUE_URL = process.env.QUEUE_URL;
if (!QUEUE_URL) {
    throw new Error('QUEUE_URL is required');
}

const sqs = new SQSClient({});

async function handleJob(job: TriageJob) {
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

    return { result, evidence, octokit };  
}

async function main() {
    while (true) {
        const res = await sqs.send(new ReceiveMessageCommand({
            QueueUrl: QUEUE_URL,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
        }));

        for (const msg of res.Messages ?? []) {
            try {
                const job = JSON.parse(msg.Body!) as TriageJob;
                await handleJob(job);
                await sqs.send(new DeleteMessageCommand({
                    QueueUrl: QUEUE_URL,
                    ReceiptHandle: msg.ReceiptHandle!,
                }));
            } catch (error) {
                console.error({ msg: 'failed to handle message', error, messageId: msg.MessageId });
            }
        }
    }
}

main().catch((err) => {
  console.error({ msg: 'worker crashed', err });
  process.exit(1);
});