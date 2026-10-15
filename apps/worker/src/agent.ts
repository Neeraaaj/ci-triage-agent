import { callStructured, MODELS } from './llm.js';
import { TriageResult } from './schema.js';
import { SYSTEM, SYSTEM_WITH_TOOLS } from './prompt.js';
import { READ_FILE_TOOL } from './readFile.js';
import { toClaudeSchema } from './claudeSchema.js';
import type { FailureContext } from './types/FailureContext.js';
import Anthropic from '@anthropic-ai/sdk';
import { startActiveObservation } from '@langfuse/tracing';

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic());

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
    name: "triage-oneshot"
  });
  return { result: {
    ...data,
    failedStep: ctx.failedJobs[0].failedStep ?? "unknown",
  },
  usage };
}

const MAX_TURNS = 5;   // hard stop: the model can never loop more than this

function parseFinal(response: Anthropic.Message) {
  if (response.stop_reason === 'max_tokens') throw new Error('hit max_tokens');
  if (response.stop_reason === 'refusal') throw new Error('model refused');
  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('no text block in final answer');
  const parsed = TriageResult.safeParse(JSON.parse(block.text));
  if (!parsed.success) throw new Error(`schema mismatch: ${parsed.error.message}`);
  return parsed.data;
}

export async function triageWithTools(
  ctx: FailureContext,
  opts: { readFile: (path: string) => Promise<string>; maxToolCalls?: number; model?: string },
) {
  const model = opts.model ?? 'claude-haiku-5-5';
  const maxToolCalls = opts.maxToolCalls ?? 3;

  // The conversation so far. The API is stateless: we resend all of it every turn.
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildUserMessage(ctx) },
  ];
  const filesRead: Record<string, string> = {};
  const toolCalls: string[] = [];
  const usage = { input_tokens: 0, output_tokens: 0 };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // 1. Ask Claude. It may answer, or ask for a file.
    const response = await startActiveObservation('llm-turn', async (gen) => {
        const response = await getClient().messages.create({
            model,
            max_tokens: 2000,
            system: SYSTEM_WITH_TOOLS,
            messages,
            tools: [READ_FILE_TOOL],
            workspace_id: process.env.ANTHROPIC_WORKSPACE_ID,
            output_config: { format: { type: 'json_schema', schema: toClaudeSchema(TriageResult) } },
        });
        gen.update({
            model,
            input: { turn, messages: messages.length },        
            output: { stop_reason: response.stop_reason },
            usageDetails: { input: response.usage.input_tokens, output: response.usage.output_tokens },
        });
        return response;
    }, { asType: 'generation' });
    usage.input_tokens += response.usage.input_tokens;
    usage.output_tokens += response.usage.output_tokens;

    if (response.stop_reason !== 'tool_use') {
      const data = parseFinal(response);
      return {
        result: { ...data, failedStep: ctx.failedJobs[0].failedStep ?? 'unknown' },
        usage, toolCalls, filesRead,
      };
    }

    messages.push({ role: 'assistant', content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const path = String((block.input as { path?: unknown }).path ?? '');

      let content: string;
      if (toolCalls.length >= maxToolCalls) {
        content = 'error: tool call limit reached. Give your final answer now.';
      } else {
        const text = await startActiveObservation('read_file', async (t) => {
        const out = await opts.readFile(path);
            t.update({ input: { path }, output: { chars: out.length, blocked: out.startsWith('error:') } });
            return out;
        }, { asType: 'tool' });
        toolCalls.push(path);
        if (!text.startsWith('error:')) filesRead[path] = text;   // raw text, for checkEvidence
        content = `<file path="${path}">\n${text}\n</file>`;       // fenced: it's data, not instructions
      }
      results.push({ type: 'tool_result', tool_use_id: block.id, content });
    }

    messages.push({ role: 'user', content: results });
  }

  throw new Error(`no final answer after ${MAX_TURNS} turns`);
}