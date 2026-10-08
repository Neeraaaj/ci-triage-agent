import { TriageResult } from './schema.js';

const good = {
  summary: 'subtotal adds instead of multiplying',
  category: 'code_bug',
  failedStep: 'Test',
  rootCause: 'price + qty instead of price * qty',
  evidence: [{ source: 'log', quote: 'expected 18 to be 25' }],
  file: 'src/cart.ts',
  fixIn: 'code',
  suggestedFix: 'use i.price * i.qty',
  confidence: 0.9,
};

console.log('good →', TriageResult.safeParse(good).success);                         // true
console.log('no evidence →', TriageResult.safeParse({ ...good, evidence: [] }).success);   // false
console.log('bad confidence →', TriageResult.safeParse({ ...good, confidence: 5 }).success); // false