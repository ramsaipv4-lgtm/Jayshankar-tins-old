# TOOLING-AUDIT.md — what this work needs, what the harness has, what is missing

> Produced by `tins-kit/prompts/TOOLING-AUDIT.md`; gated by
> `node tins-kit/scripts/tooling-audit.mjs`. Rubric:
> `tins-kit/lib/patterns/third-party-tool-audit.md`.

**Audit status:** complete

**Last audited:** 2026-08-26
**Scope of this audit:** the whole project (Scenario 1)

---

## 1. What the harness already has

Confirmed by running each check, not assumed.

- **Run JavaScript tests** — `node:test` + `node:assert`, Node v22.22.2.
  Confirmed: `node -e "require('node:test')"` succeeded.
- **Read / write / search project files** — native file tools. Confirmed in use.
- **Drive a real browser** — `playwright@1.56.0` installed globally and a
  Chromium binary present at `/opt/pw-browsers/chromium`. Confirmed via
  `npm ls -g` and `require.resolve('playwright')`.

  This one is worth recording as a finding rather than a formality. The
  initial assumption going into this audit was that no browser was available
  and that §8.8 and §8.9 would have to be waived. Checking proved that wrong.
  Had the audit been skipped, two acceptance criteria would have been
  "verified" by reading the CSS and asserting the result — which is the exact
  improvisation this gate exists to prevent.
- **Reach the npm registry** — confirmed (`npm view playwright version`
  returned). Not needed: D1 locks the project to zero dependencies.

---

## 2. What this work actually needs

Written as capabilities, not product names.

- **Execute unit tests against a plain ES module** — §8.10.
- **Render the page in a real browser engine and measure layout** — §8.8
  (no horizontal scroll at 320px).
- **Inspect computed focus styles on real focused elements** — §8.9.
- **Verify that an assistive technology announces a live-region update** —
  §6 ("the remaining-count region announces politely on change").

---

## 3. The gap, the candidates, and the verdicts

| Capability gap | Candidate | Source | Verdict | Priority | Status | Handicap / audit note |
|---|---|---|---|---|---|---|
| Verify a screen reader announces a live-region change | none found | n/a | REVIEW-REQUIRED | REQUIRED | waived | No screen reader or AT-bridge is available in this environment, and none of the candidate approaches (accessibility-tree snapshots) actually observe announcement — they observe markup. **Handicap accepted:** §6's announcement requirement is verified only as far as the `aria-live="polite"` attribute being present on the correct element with the correct text updates. Whether a real screen reader announces it is untested and is recorded as an assumption, not a fact. Any claim in the run digest about announcement behaviour is therefore a claim about markup, not about what a user would hear. |

No other gaps. Every remaining capability in §2 is covered by tooling already
present, so there is nothing to install and nothing to audit for malicious
intent — the audit's nine red flags were not exercised on this run because no
third-party candidate was recommended.

---

## 4. Waivers recorded in SPEC.md §0.2

- The screen-reader waiver above does not change any locked decision; it
  narrows what §8.9's verification can honestly claim. Recorded here and
  repeated in the run digest rather than as a new §0.2 row, since it
  constrains verification rather than design.

---

## 5. Audit log

- 2026-08-26: initial audit, Scenario 1 — 1 REQUIRED gap found and waived with
  a named handicap; 1 assumed gap (browser) disproved by checking.
