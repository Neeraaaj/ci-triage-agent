import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { toClaudeSchema } from './claudeSchema.js';
import { startActiveObservation } from '@langfuse/tracing';

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic());

export const MODELS = {
  fast: 'claude-haiku-5-5',
  smart: 'claude-sonnet-5-5',
} as const;

export async function callStructured<T extends z.ZodType>(opts: {
  model: string;
  system: string;
  user: string;
  schema: T;
  maxTokens?: number;
  name?: string;        // ← add this
}) {

    const res = await startActiveObservation(opts.name ?? 'llm-call', async (gen) => {   // ← outer name = res
        const r = await getClient().messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4000,
        system: opts.system,
        workspace_id: process.env.ANTHROPIC_WORKSPACE_ID,
        messages: [{ role: 'user', content: opts.user }],
        output_config: { format: { type: 'json_schema', schema: toClaudeSchema(opts.schema) } },
        });
        gen.update({
        model: opts.model,
        input: { userChars: opts.user.length },      // ← something that exists here
        output: { stop_reason: r.stop_reason },
        usageDetails: { input: r.usage.input_tokens, output: r.usage.output_tokens },
        });
        return r;
    }, { asType: 'generation' });

    if (res.stop_reason === 'max_tokens' || res.stop_reason === 'refusal') {
      throw new Error(`ANTHROPIC ERROR: ${res.stop_reason}, details: ${res.stop_details}`);
    }
  
    const textBlock = res.content.find((b: any) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('ANTHROPIC ERROR: no text content returned');
    }
  
    const parsed = JSON.parse(textBlock.text);
    const parsedResult = opts.schema.safeParse(parsed);
    if (!parsedResult.success) {
      throw new Error(parsedResult.error.message);
    }

    return { data: parsedResult.data as z.infer<T>, usage: res.usage };
}