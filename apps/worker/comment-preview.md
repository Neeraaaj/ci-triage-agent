<!-- ci-triage:run-37590838986 -->

### CI triage: The subtotal function in src/cart.ts changed multiplication to addition, so the 'sums price × qty' test receives 18 instead of 25.

**Note:** I'm not fully certain about this diagnosis. Please verify before acting on it.

**Failed step:** `Test` · **Category:** code bug · **Confidence:** 50%

**Root cause**

The commit replaced price * qty with price + qty inside subtotal's reduce. For items [{price:10,qty:2},{price:5,qty:1}] this yields (0+10+2)+(5+1)=18, while the test expects 10*2+5*1=25. The test's expectation matches the stated intent (price × qty), so the code is wrong.

**Evidence**

From the log:
````
AssertionError: expected 18 to be 25 // Object.is equality
````

From the diff:
````diff
+  return items.reduce((sum, i) => sum + i.price + i.qty, 0);
````

**Suggested fix:** Restore the multiplication: return items.reduce((sum, i) => sum + i.price * i.qty, 0);

<sub>ci-triage-agent · all quoted evidence verified against the log and diff</sub>