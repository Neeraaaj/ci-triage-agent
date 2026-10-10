import { EvalCase } from './types/EvalCase.t.js';
import type { TriageResult } from './schema.js';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const cleanPath = (p: string) => p.trim().replace(/^\.\//, '');

export function scoreDeterministic(c: EvalCase, r: TriageResult, evidenceOk: boolean) {
  const stepOk = same(c.failedStep, r.failedStep);

  const accepted = Array.isArray(c.file) ? c.file : [c.file];
  const file = r.file;   
  const fileOk = file !== null &&                                   
  accepted.some((f) => cleanPath(f) === cleanPath(file));  

  const fixInOk = same(c.fixIn, r.fixIn);

  return { stepOk, fileOk, fixInOk, evidenceOk };
}