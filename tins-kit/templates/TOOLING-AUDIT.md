# TOOLING-AUDIT.md — what this work needs, what the harness has, what is missing

> **Audience:** you, and every future session on this project. Produced by
> `tins-kit/prompts/TOOLING-AUDIT.md`; gated by
> `node tins-kit/scripts/tooling-audit.mjs`. Rubric:
> `tins-kit/lib/patterns/third-party-tool-audit.md`.
>
> **This is a blocking gate (D33).** Work does not start while a REQUIRED
> capability is `pending`. The failure being prevented is not untidiness —
> it is a model that, lacking a capability, quietly improvises: guesses at
> an API response, estimates a number it could have looked up, writes a
> plausible paragraph where a real query belonged.

**Audit status:** pending
<!-- Set to `complete` only when every gap in the table below has been
     searched for, every candidate has been read and given a verdict, and
     the user has decided install-or-waive on each REQUIRED row. The gate
     fails while this says anything other than `complete`. -->

**Last audited:** <YYYY-MM-DD>
**Scope of this audit:** <the whole project (Scenario 1) | W<n> (Scenario 3)>

---

## 1. What the harness already has

<Confirmed, not assumed. MCP servers and their tools, loaded skills, CLI
tools on PATH that this work would use, network reach, filesystem reach.
"Probably has a browser tool" is exactly the assumption this section kills
— if you could not confirm it, it is absent.>

- <capability> — <how you confirmed it>

---

## 2. What this work actually needs

<Capabilities, not product names: "query the project's Postgres directly",
not "the Postgres MCP". Naming the capability keeps §3 open to candidates
you had not thought of, and keeps a waiver honest about what is really
being given up.>

- <capability> — <which spec section or W needs it, and for what>

---

## 3. The gap, the candidates, and the verdicts

| Capability gap | Candidate | Source | Verdict | Priority | Status | Handicap / audit note |
|---|---|---|---|---|---|---|
| <what's missing> | <name or "none found"> | <url> | SAFE \| REVIEW-REQUIRED \| UNSAFE | REQUIRED \| RECOMMENDED \| OPTIONAL | pending \| installed \| waived | <see below> |

**Verdict** — from the rubric's nine red flags:
- `SAFE` — read it, understood it, no flag fired, declared scope matches the
  stated job, publisher identifiable. Means "nothing in the source gave
  cause for concern", **not** "executed and observed to be harmless".
- `REVIEW-REQUIRED` — something gave pause, or something could not be fully
  understood. The note **must** name the file and lines to read and why.
- `UNSAFE` — a flag fired unambiguously. Never installed, never softened
  because the tool is convenient or is the only candidate.

**Uncertainty resolves to REVIEW-REQUIRED, never SAFE.** "I did not find
anything" is not the same finding as "I looked everywhere and there is
nothing."

**Priority** — about what happens to the work without it:
- `REQUIRED` — the work cannot be done honestly without it. You would be
  substituting assumptions for real data, or could not verify an acceptance
  criterion at all. **REQUIRED rows block the gate.**
- `RECOMMENDED` — doable, but slower or more manual.
- `OPTIONAL` — convenience.

**Handicap / audit note** — for `waived`, this cell is mandatory and must
name the capability given up **and** where assumptions now stand in for
real data. "Skipped, not needed" fails the gate. Write it like:

> No database MCP, so every figure in §4 comes from the sample pasted during
> the interview, not from a live query. Any claim about row counts is an
> estimate until this is installed.

That sentence is what the next session inherits. Without it the handicap is
invisible, and invisible handicaps get written up as facts.

---

## 4. Waivers recorded in SPEC.md §0.2

<Every waived REQUIRED row is also a locked row in the project's own SPEC.md
§0.2, so the handicap travels with the spec rather than living only here.>

- <D_n_: Tooling waiver — <capability> not available; <consequence>>

---

## 5. Audit log

<Append a line each time this audit is re-run — date, scope, what changed.
Re-audit is triggered by a new W or an explicit request, not on a schedule.>

- <date>: <initial audit | re-audit for W<n>> — <result>
