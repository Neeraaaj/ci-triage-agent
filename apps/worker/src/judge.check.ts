import { judgeRootCause } from './judge.js';

const pairs = [
  { expect: true,  ref: 'subtotal adds price + qty instead of multiplying price * qty',
    cand: 'The reducer sums quantity and price rather than taking their product.' },
  { expect: false, ref: 'subtotal adds price + qty instead of multiplying price * qty',
    cand: 'applyDiscount rounds the result incorrectly.' },
  { expect: false, ref: 'two bugs: subtotal adds instead of multiplying, AND the error message changed to "discount out of range"',
    cand: 'subtotal adds price and qty instead of multiplying them.' },
  { expect: false, ref: 'the test expectation is wrong (expects 20); applyDiscount correctly returns 180',
    cand: 'applyDiscount returns the wrong value; the function needs fixing.' },
];

for (const p of pairs) {
  const v = await judgeRootCause(p.ref, p.cand);
  console.log(v.match === p.expect ? '✅' : '❌', { expect: p.expect, got: v.match, reason: v.reason });
}