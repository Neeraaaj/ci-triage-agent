import {SQSClient, ReceiveMessageCommand, DeleteMessageCommand} from '@aws-sdk/client-sqs';

type TriageJob = {
    deliveryId: string;
    installationId: number;
    repo: string;
    runId: number;
    headSha: string;
    prNumbers: number[];
};

const QUEUE_URL = process.env.QUEUE_URL;
if (!QUEUE_URL) {
    throw new Error('QUEUE_URL is required');
}

const sqs = new SQSClient({});

async function handleJob(job: TriageJob) {
    console.log({ msg: 'handling', ...job });
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