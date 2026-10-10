import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { toClaudeSchema } from './claudeSchema.js';
import { TriageResult } from './schema.js';

const client = new Anthropic();

export async function callStructured<T extends z.ZodType>(opts: {
  model: string;
  system: string;
  user: string;
  schema: T;
  maxTokens?: number;
}) {
  const res = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    workspace_id: process.env.ANTHROPIC_WORKSPACE_ID,
    messages: [{ role: 'user', content: opts.user }],
    output_config: { format: { type: 'json_schema', schema: toClaudeSchema(opts.schema) } },
  });

  console.log('central hub for agent configs');
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