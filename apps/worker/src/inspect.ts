import { triage, triageWithTools } from './agent.js';   // put this with the other imports at the top
import { checkEvidence } from './verify.js';
import { loadCase } from './replay.js';
import { writeFileSync } from 'node:fs';
import { renderComment } from './comment.js';

const AGENT = process.argv.includes('--tools') ? 'tools' : (process.env.AGENT ?? 'oneshot');
const runId = Number(process.argv[2]);
if (!runId) throw new Error('usage: tsx src/inspect.ts <runId>');

const loaded = await loadCase(runId);
const {ctx, readFile} = loaded;

for (const j of ctx.failedJobs) {
  console.log(`\n===== job: ${j.name} | failed step: ${j.failedStep} =====`);
  console.log(j.logTail);
}
console.log(`\n===== diff (${ctx.diff.split('\n').length} lines) =====`);
console.log(ctx.diff);
const useTools = process.argv.includes('--tools');

const t0 = Date.now();
const out = useTools
  ? await triageWithTools(ctx, { readFile })
  : await triage(ctx);
const ms = Date.now() - t0;

const filesRead = 'filesRead' in out ? out.filesRead : {};
const toolCalls = 'toolCalls' in out ? out.toolCalls : [];

console.log('\n===== TRIAGE =====');
console.log(JSON.stringify(out.result, null, 2));
console.log({ mode: AGENT, toolCalls, ms,
              inputTokens: out.usage.input_tokens, outputTokens: out.usage.output_tokens });

const evidence = checkEvidence(out.result, ctx, filesRead);
console.log('evidence:', evidence);

const md = renderComment(out.result, evidence, runId);   // reuse the same evidence object
writeFileSync('comment-preview.md', md);
console.log('wrote comment-preview.md');