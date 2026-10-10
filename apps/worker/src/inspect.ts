import { getRepoClient, fetchFailureContext } from './github.js';
import type { TriageJob } from './types/TriageJob.js';   // ← adjust to your file name
import { triage } from './agent.js';   // put this with the other imports at the top
import { checkEvidence } from './verify.js';
import { loadCase } from './replay.js';

const runId = Number(process.argv[2]);
if (!runId) throw new Error('usage: tsx src/inspect.ts <runId>');

const ctx = await loadCase(runId);

for (const j of ctx.failedJobs) {
  console.log(`\n===== job: ${j.name} | failed step: ${j.failedStep} =====`);
  console.log(j.logTail);
}
console.log(`\n===== diff (${ctx.diff.split('\n').length} lines) =====`);
console.log(ctx.diff);
const t0 = Date.now();
const { result, usage } = await triage(ctx);
console.log('\n===== TRIAGE =====');
console.log(JSON.stringify(result, null, 2));
console.log({ ms: Date.now() - t0, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens });
console.log('evidence check →', checkEvidence(result, ctx));