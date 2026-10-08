import Anthropic from '@anthropic-ai/sdk';
import { TriageResult } from './schema.js';
import { toClaudeSchema } from './claudeSchema.js';
import {SYSTEM} from './prompt.js'
import { error } from 'node:console';

const client = new Anthropic(); 


type FailureContext = {
  failedJobs: { name: string; failedStep: string | null; logTail: string }[];
  diff: string;
};

export async function triage(ctx: FailureContext, model = 'claude-haiku-5-5') {
  // TODO 1: build the user message string with <failed_step>, <log>, <diff> tags
  //         (use ctx.failedJobs[0] for now; multi-job comes later)
  const job = ctx.failedJobs[0];
  const userMessage = `
    <failed_step>
    ${job.failedStep ?? 'Unknown'}
    </failed_step>

    <log>
    ${job.logTail}
    </log>

    <diff>
    ${ctx.diff}
    </diff>
    `
  ;

  const res = await client.messages.create({
    model,
    max_tokens: 4000,
    system: SYSTEM,
    workspace_id: "wrkspc_01Pxi4pNBqneUo8e8TDGr544",
    messages: [{ role: 'user', content:  userMessage }],
    output_config: {
      format: { type: 'json_schema', schema: toClaudeSchema(TriageResult) },
    },
  });

  if (res.stop_reason === 'max_tokens' || res.stop_reason === 'refusal') {
    throw new Error(`ANTHROPIC ERROR: ${res.stop_reason}, details: ${res.stop_details}`);
  }

  const textBlock = res.content.find((b: any) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('ANTHROPIC ERROR: no text content returned');
  }

  const parsed = JSON.parse(textBlock.text);
  const parsedResult = TriageResult.safeParse(parsed);
  if (!parsedResult.success) {
    throw new Error(parsedResult.error.message);
  }

  return { result: parsedResult.data, usage: res.usage };
}