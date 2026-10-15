import { handler } from './handler.js';

const job = {
  deliveryId: 'local-invoke',
  installationId: 168128313,
  repo: 'Neeraaaj/triage-demo',
  runId: 38230707199,
  headSha: 'e130f1f14e3e2b78a17649b0f7b7db9284db4594',
  prNumbers: [13],
};

const result = await handler({
  Records: [{ messageId: 'local-1', body: JSON.stringify(job) }],
} as any);

console.log(result);