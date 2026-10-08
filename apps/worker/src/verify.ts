import { TriageResult } from "./schema.js";
import { FailureContext } from "./types/FailureContext.js";

export function checkEvidence(result: TriageResult, ctx: FailureContext): { ok: boolean; missing: string[] } {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

    const logText = norm(ctx.failedJobs.map(job => job.logTail).join('\n'));

    const diffText = norm(ctx.diff);

    const missing: string[] = [];

    for (const evidence of result.evidence) {
    const haystack =
        evidence.source === "log"
        ? logText
        : diffText;

    const normalizedHaystack = haystack
        .replace(/\s+/g, " ")
        .trim();

    const normalizedQuote = evidence.quote
        .replace(/\s+/g, " ")
        .trim();

    if (!normalizedHaystack.includes(normalizedQuote)) {
        missing.push(evidence.quote);
    }
    }

    return {
    ok: missing.length === 0,
    missing,
    };
}