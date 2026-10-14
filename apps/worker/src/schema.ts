import { z } from 'zod';

export const TriageResult = z.object({
  summary: z.string(),
  category: z.enum(['code_bug', 'test_bug', 'type_error', 'dependency', 'config_env', 'timeout', 'infra', 'unknown']),
  failedStep: z.string(),
  rootCause: z.string(),
  evidence: z.array(z.object({
  source: z.enum(['log', 'diff', 'file']),
  quote: z.string().describe('Copied VERBATIM from the log, the diff, or a file you read with read_file. Do not paraphrase.'),
    })).min(1).describe('Exact lines that prove the root cause'),
  file: z.string().nullable(),
  fixIn: z.enum(['code', 'test', 'config', 'unknown'])
  .describe("Where the fix belongs. 'test' if the test's expectation is wrong and the code is correct. " +
          "If both a code fix and a test fix are reasonable, choose the more likely one. " +
          "Use 'unknown' only when the log and diff give no indication."),
  suggestedFix: z.string(),
  confidence: z.number().min(0).max(1).describe('0.9+ only if evidence directly shows the cause'),
});

export type TriageResult = z.infer<typeof TriageResult>;