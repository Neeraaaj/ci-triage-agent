import { handler } from './handler.js';

const job = {
  deliveryId: 'local-invoke',
  installationId: 168128313,
  repo: 'Neeraaaj/triage-demo',
  runId: 37590838986,
  headSha: 'bc8bee54b9f8f839ffcf38b26292b557321b7dc7',
  prNumbers: [1],
};

const result = await handler({
  Records: [{ messageId: 'local-1', body: JSON.stringify(job) }],
} as any);

console.log(result);