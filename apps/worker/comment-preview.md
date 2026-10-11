<!-- ci-triage:run-37590838986 -->

### CI triage: The cart test fails because subtotal() now adds price and qty instead of multiplying them, so the result is 18 instead of 25.

**Failed step:** `Test` · **Category:** code bug · **Confidence:** 95%

**Root cause**

In src/cart.ts, subtotal() changed the per-item calculation from price * qty to price + qty. For the test input [{price:10,qty:2},{price:5,qty:1}] the correct total is 20+5=25, but the new code gives (10+2)+(5+1)=18. The test expectation is correct and the code change is the bug.

**Evidence**

From the log:
````
AssertionError: expected 18 to be 25 // Object.is equality
````

From the diff:
````diff
return items.reduce((sum, i) => sum + i.price + i.qty, 0);
````

**Suggested fix:** Restore the multiplication: return items.reduce((sum, i) => sum + i.price * i.qty, 0);

<sub>ci-triage-agent · all quoted evidence verified against the log and diff</sub>