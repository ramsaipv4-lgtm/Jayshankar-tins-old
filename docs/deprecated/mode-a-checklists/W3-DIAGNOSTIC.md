# W3 Diagnostic — SkuSelect dropdown empty / unselectable

> Run these in DevTools console while on the delivery form (or any form
> that has a SKU select). Tell me what each one prints.

```js
// 1. Does the supabase client exist?
console.log('window.__sb__:', !!window.__sb__);

// 2. Direct query for SKUs as the signed-in user
const r = await window.__sb__.from('skus').select('id, code, name').order('name');
console.log('SKUs query result:', JSON.stringify(r, null, 2));

// 3. Are there <option> elements in the SKU dropdown?
const skuSelect = document.querySelector('#sku');
console.log('SKU <select> element:', skuSelect);
console.log('SKU <option> count:', skuSelect?.querySelectorAll('option').length);
console.log('First 3 options:', Array.from(skuSelect?.querySelectorAll('option') ?? []).slice(0, 3).map(o => o.textContent));
```

**Three possible outcomes:**

| What you see | Cause | Fix |
|---|---|---|
| SKUs query result.data is `[]` (empty) and error is null | RLS silently denying the read for the signed-in user (worker role can't read SKUs in some RLS setups, OR the migration isn't applied) | Run the `rls-policies.sql` again in SQL Editor (no reset needed) |
| SKUs query result has an error | Network or auth issue | Paste the error object here |
| Query returns 25 SKUs but `<option> count` is 0 (or 1, just the placeholder) | UI bug — the SkuSelect component isn't rendering the options even though the data is there | I'll need to look at the React Query state; let me also paste the output of: `console.log(JSON.parse(JSON.stringify(window.__sb__)))` for sanity |
| `<option> count` is 25+ but clicking doesn't select | CSS or focus issue — the select is being intercepted by another element | Inspect the element (right-click → Inspect) and tell me what the parent z-index / position looks like |

Paste the outputs of all three checks and I'll know exactly what's going wrong.