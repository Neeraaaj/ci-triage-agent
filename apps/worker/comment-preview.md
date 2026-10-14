<!-- ci-triage:run-38230707199 -->

### CI triage: slugify('!!!Hello!!!') returns 'hello-' instead of 'hello'. The trailing-hyphen removal regex is not global and has no quantifier, so it strips only one hyphen, and only the first match.

**Failed step:** `Test` · **Category:** code bug · **Confidence:** 95%

**Root cause**

In src/slug.ts the final replace uses /^-|-$/ with no g flag. Non-global replace only removes the first match, which is the leading hyphen. The trailing hyphen survives. The regex also has no + quantifier, so it could not remove runs of hyphens anyway. The input becomes '-hello-' after the earlier replace, and this step returns 'hello-'. The test expectation of 'hello' is correct.

**Evidence**

From the log:
````
AssertionError: expected 'hello-' to be 'hello' // Object.is equality
````

From the log:
````
   × removes multiple leading and trailing hyphens 4ms
````

From the log:
````
    .replace(/^-|-$/, '');
````

**Suggested fix:** Change the last replace to .replace(/^-+|-+$/g, '') so both leading and trailing hyphen runs are removed globally.

<sub>ci-triage-agent · all quoted evidence verified against the log and diff</sub>