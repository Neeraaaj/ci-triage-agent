import { z } from 'zod';

// Walks the JSON Schema and makes it API-compatible
function adapt(node: any): any {
  if (Array.isArray(node)) return node.map(adapt);
  if (node && typeof node === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (['$schema', 'minimum', 'maximum', 'minLength', 'maxLength'].includes(k)) continue; // unsupported
      out[k] = adapt(v);
    }
    if (out.type === 'object') out.additionalProperties = false; // required by the API
    return out;
  }
  return node;
}

export function toClaudeSchema(schema: z.ZodType) {
  return adapt(z.toJSONSchema(schema));
}