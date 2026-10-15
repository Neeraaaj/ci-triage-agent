import { startActiveObservation } from '@langfuse/tracing';

await startActiveObservation('smoke-test', async (span) => {
  span.update({ input: { hello: 'world' } });
  await new Promise((r) => setTimeout(r, 200));      // pretend to work
  span.update({ output: { ok: true } });
});