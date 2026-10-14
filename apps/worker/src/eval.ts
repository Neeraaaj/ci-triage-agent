import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadCase } from './replay.js';
import { triage, triageWithTools } from './agent.js';
import { checkEvidence } from './verify.js';
import { scoreDeterministic } from './score.js';
import { judgeRootCause } from './judge.js';
import type { EvalCase } from './types/EvalCase.t.js';

const AGENT = process.env.AGENT ?? 'oneshot';   
// $ per million tokens. Check the current Haiku 5.5 price on Anthropic's pricing page.
const PRICE = { inPerMTok: 0.10, outPerMTok: 0.50 };
const costOf = (u: { input_tokens: number; output_tokens: number }) =>
  (u.input_tokens * PRICE.inPerMTok + u.output_tokens * PRICE.outPerMTok) / 1_000_000;

const casesUrl = new URL('../../../evals/cases.json', import.meta.url);
const cases: EvalCase[] = JSON.parse(readFileSync(casesUrl, 'utf8'));

const rows: any[] = [];

const RUNS = Number(process.env.RUNS ?? 3);
const perCase: { id: string; passes: number }[] = [];          // ← A: once, above everything

for (const c of cases) {
  let passes = 0;
  process.stdout.write(`case ${c.id} ... `);

  let loaded: Awaited<ReturnType<typeof loadCase>>;

  try {
    loaded = await loadCase(c.runId);
  } catch (err) {
    rows.push({ id: c.id, error: String(err) });
    console.log('💥 load failed', String(err));
    perCase.push({ id: c.id, passes: 0 });
    continue;
  }
  const { ctx, readFile } = loaded;

  for (let r = 0; r < RUNS; r++) {
    try {
      const t0 = Date.now();
      const out = AGENT === 'tools'                                    // ←
        ? await triageWithTools(ctx, { readFile })                     // ←
        : await triage(ctx);                                           // ←
      const ms = Date.now() - t0;
      const filesRead = 'filesRead' in out ? out.filesRead : {};       // ←
      const toolCalls = 'toolCalls' in out ? out.toolCalls : [];   

      const evidence = checkEvidence(out.result, ctx, filesRead);
      const det = scoreDeterministic(c, out.result, evidence.ok);
      const verdict = await judgeRootCause(c.rootCause, out.result.rootCause);

      const row = {
        id: c.id,
        run: r,                                               
        ...det,
        rootCauseOk: verdict.match,
        allOk: det.stepOk && det.evidenceOk && det.fileOk && det.fixInOk && verdict.match, 
        ms,
        confidence: out.result.confidence,
        agentCost: costOf(out.usage),
        judgeCost: costOf(verdict.usage),
        missingQuotes: evidence.missing,
        judgeReason: verdict.reason,
        answer: out.result,
        toolCalls,
      };
      rows.push(row);
      if (row.allOk) passes++;
      process.stdout.write(row.allOk ? '✅' : '❌');          
    } catch (err) {
      rows.push({ id: c.id, run: r, error: String(err) });
      process.stdout.write('💥');
    }

}
    perCase.push({ id: c.id, passes });                          
    console.log(` ${passes}/${RUNS}`);
}

const totalAttempts = cases.length * RUNS;
const totalPasses = perCase.reduce((sum, p) => sum + p.passes, 0);
const passAt1 = totalPasses / totalAttempts;

const alwaysRight = perCase.filter((p) => p.passes === RUNS).length;
const passK = alwaysRight / cases.length;

console.log(`pass@1  ${(passAt1 * 100).toFixed(1)}%   (RUNS=${RUNS})`);
console.log(`pass^${RUNS}  ${(passK * 100).toFixed(1)}%`);


const ok = rows.filter((r) => !r.error);

const easyRows = ok.filter((r) => r.id !== '13');

const case13Rows = ok.filter((r) => r.id === '13');

const avgToolCalls = (items: any[]) =>
  items.length === 0
    ? 0
    : items.reduce(
        (sum, r) => sum + (r.toolCalls?.length ?? 0),
        0,
      ) / items.length;

console.log(
  `avg tool calls  01-12: ${avgToolCalls(easyRows).toFixed(2)}   13: ${avgToolCalls(case13Rows).toFixed(2)}`,
);

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
writeFileSync(new URL(`${stamp}.json`, outDir),
    JSON.stringify({ model: 'claude-haiku-5-5', AGENT, RUNS, passAt1, passK, perCase, rows }, null, 2));
console.log(`saved evals/results/${stamp}.json`);