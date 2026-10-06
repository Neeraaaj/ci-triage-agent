import { Hono } from 'hono';
import { verifySignature } from './verify';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

// ── Setup: runs once at startup ─────────────────────
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) throw new Error('GITHUB_WEBHOOK_SECRET is not set');

const QUEUE_URL = process.env.QUEUE_URL;
if (!QUEUE_URL) throw new Error('QUEUE_URL is not set');

const sqs = new SQSClient({ region: process.env.AWS_REGION });

export const app = new Hono();

// ── Per request ─────────────────────────────────────
app.post('/webhook', async (c) => {
  const rawBody = await c.req.text();
  const event = c.req.header('x-github-event');
  const deliveryId = c.req.header('x-github-delivery');
  const signature = c.req.header('x-hub-signature-256');

  if (!verifySignature(WEBHOOK_SECRET, rawBody, signature)) {
    return c.text('invalid signature', 401);
  }

  const payload = JSON.parse(rawBody);

  if (event !== 'workflow_run' || payload.action !== 'completed' || payload.workflow_run?.conclusion !== 'failure') {
    return c.text('ignored', 202);
  }

  const job = {
    deliveryId,
    installationId: payload.installation?.id,
    repo: payload.repository?.full_name,
    runId: payload.workflow_run?.id,
    headSha: payload.workflow_run?.head_sha,
    prNumbers: payload.workflow_run?.pull_requests?.map((p: any) => p.number),
  };

  try {
    await sqs.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(job),
    }));
  } catch (err) {
    console.error({ msg: 'enqueue failed', deliveryId, err });
    return c.text('enqueue failed', 500);
  }

  console.log({ msg: 'enqueued', ...job });
  return c.text('accepted', 202);
});