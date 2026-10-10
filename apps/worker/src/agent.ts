import { callStructured } from './llm.js';
import { TriageResult } from './schema.js';
import { SYSTEM } from './prompt.js';
import type { FailureContext } from './types/FailureContext.js';

function buildUserMessage(ctx: FailureContext) {
  const job = ctx.failedJobs[0];
  return [
    `<failed_step>${job.failedStep ?? 'Unknown'}</failed_step>`,
    `<log>\n${job.logTail}\n</log>`,
    `<diff>\n${ctx.diff}\n</diff>`,
  ].join('\n\n');
}

export async function triage(ctx: FailureContext, model = 'claude-haiku-5-5') {
  const { data, usage } = await callStructured({
    model,
    system: SYSTEM,
    user: buildUserMessage(ctx),
    schema: TriageResult,
  });
  return { result: data, usage };
}