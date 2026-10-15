import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { handleJob } from './job.js';
import type { TriageJob } from './types/TriageJob.js';
import { initTracing, flushTracing } from './instrumentation.js';

const sm = new SecretsManagerClient({});

async function readSecret(id: string): Promise<string> {
  const res = await sm.send(new GetSecretValueCommand({ SecretId: id }));
  if (!res.SecretString) throw new Error(`Secret ${id} is empty`);
  return res.SecretString;
}

// Load secrets ONCE per Lambda instance and put them where our code expects them
let ready: Promise<void> | undefined;

function loadSecrets(): Promise<void> {
  ready ??= (async () => {
    const [appJson, privateKey] = await Promise.all([
      readSecret(process.env.APP_SECRET_NAME!),
      readSecret(process.env.PRIVATE_KEY_SECRET_NAME!),
    ]);

    let app: Record<string, string>;
    try {
      app = JSON.parse(appJson);
    } catch {
      throw new Error('app secret is not valid JSON');   // never include the value
    }

    process.env.ANTHROPIC_API_KEY = app.ANTHROPIC_API_KEY;
    if (app.ANTHROPIC_WORKSPACE_ID) process.env.ANTHROPIC_WORKSPACE_ID = app.ANTHROPIC_WORKSPACE_ID;
    process.env.GITHUB_PRIVATE_KEY = privateKey;

    if (app.LANGFUSE_PUBLIC_KEY) process.env.LANGFUSE_PUBLIC_KEY = app.LANGFUSE_PUBLIC_KEY;
    if (app.LANGFUSE_SECRET_KEY) process.env.LANGFUSE_SECRET_KEY = app.LANGFUSE_SECRET_KEY;
    initTracing();
  })().catch((err) => {
    ready = undefined;   // don't cache a failure: let the next invocation try again
    throw err;
  });
  return ready;
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  await loadSecrets();

  const batchItemFailures: SQSBatchItemFailure[] = [];

  try{
      for (const record of event.Records) {
        try {
          const job = JSON.parse(record.body) as TriageJob;
          await handleJob(job);
        } catch (err) {
          console.error({ msg: 'job failed', messageId: record.messageId, err: String(err) });
          batchItemFailures.push( {itemIdentifier: record.messageId} )
        }
      }
  } finally {
    try {
      await flushTracing();
    } catch (err) {
      console.log({ msg: 'trace flush failed', err: String(err) });   // never fail the batch over tracing
    }
  }
  return { batchItemFailures };
}