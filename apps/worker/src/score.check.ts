import { scoreDeterministic } from './score.js';

const c = {
  id: '10', pr: 10, runId: 1, category: 'dependency', failedStep: 'Run npm ci',
  file: ['package.json', 'package-lock.json'], fixIn: 'config' as const, rootCause: '...',
};

const r: any = { failedStep: 'run npm ci', file: './package-lock.json', fixIn: 'Config' };

console.log(scoreDeterministic(c, r, true));
// expected: { stepOk: true, fileOk: true, fixInOk: true, evidenceOk: true }

console.log(scoreDeterministic(c, { ...r, file: 'src/cart.ts' }, true));
// expected: fileOk: false

console.log(scoreDeterministic(c, { ...r, file: null }, true));
// expected: fileOk: false (and no crash)