import type { TriageResult } from './schema.js';

export const markerFor = (runId: number) => `<!-- ci-triage:run-${runId} -->`;

const CATEGORY_LABEL: Record<TriageResult['category'], string> = {
  code_bug: 'code bug', test_bug: 'test bug', type_error: 'type error',
  dependency: 'dependency', config_env: 'config / env', timeout: 'timeout',
  infra: 'CI infrastructure', unknown: 'unknown',
};

export function renderComment(
  result: TriageResult,
  evidence: { ok: boolean; missing: string[] },
  runId: number,
): string {
  const unsure = result.confidence < 0.7 || !evidence.ok;
  const pct = Math.round(result.confidence * 100);

  const evidenceBlocks = result.evidence.map((e) => {
  if (e.source === 'diff') {
    return `From the diff:\n\`\`\`\`diff\n${e.quote}\n\`\`\`\``;
  }

   return `From the log:\n\`\`\`\`\n${e.quote}\n\`\`\`\``;
  });

  const lines = [
  markerFor(runId),
  `### CI triage: ${result.summary}`,

  unsure
    ? "**Note:** I'm not fully certain about this diagnosis. Please verify before acting on it."
    : "",

  `**Failed step:** \`${result.failedStep}\` · **Category:** ${CATEGORY_LABEL[result.category]} · **Confidence:** ${pct}%`,

  "**Root cause**",
  result.rootCause,

  "**Evidence**",
  ...evidenceBlocks,

  `**Suggested fix:** ${result.suggestedFix}`,

  `<sub>ci-triage-agent · ${
    evidence.ok
      ? "all quoted evidence verified against the log and diff"
      : "some quoted evidence could not be verified"
  }</sub>`,
];

  return lines.filter(Boolean).join('\n\n');
}