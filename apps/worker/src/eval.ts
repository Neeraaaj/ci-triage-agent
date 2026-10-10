import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadCase } from './replay.js';
import { triage } from './agent.js';
import { checkEvidence } from './verify.js';
import { scoreDeterministic } from './score.js';
import { judgeRootCause } from './judge.js';
import type { EvalCase } from './types/EvalCase.t.js';

// $ per million tokens. Check the current Haiku 5.5 price on Anthropic's pricing page.
const PRICE = { inPerMTok: 0.10, outPerMTok: 0.50 };
const costOf = (u: { input_tokens: number; output_tokens: number }) =>
  (u.input_tokens * PRICE.inPerMTok + u.output_tokens * PRICE.outPerMTok) / 1_000_000;

const casesUrl = new URL('../../../evals/cases.json', import.meta.url);
const cases: EvalCase[] = JSON.parse(readFileSync(casesUrl, 'utf8'));

const rows: any[] = [];

for (const c of cases) {
  process.stdout.write(`case ${c.id} ... `);
  try {
    const ctx = await loadCase(c.runId);

    const t0 = Date.now();
    const { result, usage } = await triage(ctx);
    const ms = Date.now() - t0;

    const evidence = checkEvidence(result, ctx);
    const det = scoreDeterministic(c, result, evidence.ok);
    const verdict = await judgeRootCause(c.rootCause, result.rootCause);

    const row = {
      id: c.id,
      ...det,                       
      rootCauseOk: verdict.match,
      allOk: det.stepOk && det.evidenceOk && det.fileOk && det.fixInOk,
      ms,
      confidence: result.confidence,
      agentCost: costOf(usage),
      judgeCost: costOf(verdict.usage),
      missingQuotes: evidence.missing,
      judgeReason: verdict.reason,
      answer: result,                      // the full agent output, for debugging later
    };
    rows.push(row);
    console.log(row.allOk ? '✅' : '❌');
  } catch (err) {
    rows.push({ id: c.id, error: String(err) });
    console.log('💥', String(err));
  }
}

const ok = rows.filter((r) => !r.error);
const n = rows.length;

const metrics = ['stepOk', 'fileOk', 'fixInOk', 'evidenceOk', 'rootCauseOk', 'allOk'];
console.table(ok.map((r) => ({
  id: r.id, step: r.stepOk, file: r.fileOk, fixIn: r.fixInOk,
  evid: r.evidenceOk, root: r.rootCauseOk, ms: r.ms, conf: r.confidence,
})));

for (const m of metrics) {
  const passed = ok.filter((r) => r[m] === true).length;
  console.log(`${m.padEnd(12)} ${passed}/${n}`);
}

const times = ok.map((r) => r.ms).sort((a, b) => a - b);
const avg = times.reduce((s, t) => s + t, 0) / times.length;
const p95 = times[Math.ceil(0.95 * times.length) - 1];

const agentTotal = ok.reduce((s, r) => s + r.agentCost, 0);
const judgeTotal = ok.reduce((s, r) => s + r.judgeCost, 0);

console.log({
  errors: n - ok.length,
  avgMs: Math.round(avg),
  p95Ms: p95,
  agentCostPerCase: agentTotal / ok.length,
  judgeCostTotal: judgeTotal,
});

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = new URL('../../../evals/results/', import.meta.url);
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL(`${stamp}.json`, outDir), JSON.stringify({ model: 'claude-haiku-5-5', rows }, null, 2));
console.log(`saved evals/results/${stamp}.json`);