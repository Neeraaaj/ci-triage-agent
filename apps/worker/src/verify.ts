import { TriageResult } from "./schema.js";
import { FailureContext } from "./types/FailureContext.js";

export function checkEvidence(result: TriageResult, ctx: FailureContext, filesRead: Record<string, string> = {}): { ok: boolean; missing: string[] } {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

    const logText = norm(ctx.failedJobs.map(job => job.logTail).join('\n'));

    const diffText = norm(ctx.diff);

    const missing: string[] = [];

    const fileText = norm(Object.values(filesRead).join('\n'));

    for (const evidence of result.evidence) {
    const haystack =
      evidence.source === 'log'  ? logText  :
      evidence.source === 'diff' ? diffText :
                                    fileText;

    if (!haystack.includes(norm(evidence.quote))) {
        missing.push(evidence.quote);
    }
    }

    return {
    ok: missing.length === 0,
    missing,
    };
}