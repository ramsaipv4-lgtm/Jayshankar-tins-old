# Round 1 — Economics and evidence

Reviewer lens: do the drafts' cost claims survive real numbers? Scripts and raw outputs: `/tmp/claude-1000/-mnt-c-Users-user-Desktop-Jayshankar/02325b7f-26ba-406b-923e-26693d73389a/scratchpad/r1-economics/`.

**Assumed price multipliers (labelled, not real prices):** uncached input 1.0, cache write 1.25, cache read 0.1, output 5.0 ("units"). Tokens = chars/4. Where a number is a measurement it says so; everything else is inferred.

## 1. Verdict

The "reading first, writing last" ordering holds in the one session measured: tool-result reading cost about 30% of the session and documentation writing about 6%. But the cost is driven by **turns multiplied by context size**, not by file size, and the drafts never model that. The proposal's own overhead (extra tool calls, dispositions, a map-then-reduce reconciler) costs about as much as it saves except for a long, parallel, large-context project. Routing writing to a cheaper model is worth roughly 2–3% of session cost, and only about 45% of a decision's sentences are even eligible. Parts of the proposal are worth building (mechanised drift checks, hook-written ledger facts, per-record files for N≥2 parallel agents). The rest should wait for a second consumer and a measurement.

## 2. Measured

**Required-reading chain** (measured, `wc -c`):

| Item | tokens |
|---|---|
| AGENTS 3.8K + HANDOVER 9.3K + SPEC §0 19.4K + REVIEWER 4.1K + last 5 BUILDER decisions 5.4K | **41.9K** (minimal) |
| + SPEC §2/§4 for the work item | 60.7K |
| + NEXT-AGENT-ONBOARDING 4.1K, amendments v3+v4 13.6K, DECISIONS.md 13.2K, README 2K | about 93K |
| Everything listed, in full (BUILDER log alone is 82.5K) | about 239K |
| Kit chain for a fresh consumer: AGENTS 2.7K + PIPELINE 3.6K + INDEX 5K + CONTINUE-TINS-PROJECT 3.8K | **15.1K** |

SPEC §0 is the biggest single item (77.5K chars, 24% of the minimal chain).

Per-session ingestion is about 76K tokens (project minimal + build sections + kit). In cache-adjusted units over a 150-call session that is about 1.2M per agent, so 3.7M for 3 agents and 7.4M for 6. Without caching it is about 11M, 34M and 69M. The cost scales linearly in N, with no sharing: the first context differs per harness.

**Transcript of the previous session** (`02325b7f….jsonl`, aggregates only; the file is still growing, so figures drift by a few calls):
- 294 distinct API calls. Calls by kind: Bash 232 (about 85 grep, 37 ls/wc/head/cat, 21 git, 17 gate runs, 72 scripts or heredocs), Read 93, Edit 22, Write 17, Agent 6.
- Tokens: output 432K, cache-read 127.5M (about 430K per call), cache-creation 1.08M. Median context 496K, peak 966K. One compaction, at call 233.
- Cost units: about 16.3M, of which cache-read is 78%, cache-write 8% and output 13%.
- Tool-result bytes: Read 731K chars (97% .md, 50 md reads of 68 distinct files), Bash 476K.
- Authored content: .md 113K chars via Write/Edit plus about 146K via heredoc, versus 92K chars of code/data. About three quarters of what was written is documentation, so this was a docs session and is not a typical build session.

Attribution (units, with the corrected carry model):

| Share of session cost | % |
|---|---|
| Reading .md | about 21 |
| grep/ls/git results (verification) | about 9 |
| Docs writing (output plus carry) | about 6 |
| Code writing | about 1 |
| Thinking (inferred by subtraction: 432K output tokens minus about 157K visible) | about 8 |
| Baseline per-turn context (system prompt, tools, memory) | about 8 |
| Unexplained context | rest |

**Findings that contradict the draft's premise:**
1. The 4,500-line decision log was **never read** (0 Read calls). It was touched 56 times by grep or sed, retrieving about 26K of its 82K tokens. The model was already doing indexed lookup. What cost money was the 56 round trips.
2. Each call re-reads about 430K cached tokens, roughly 43K units, about the price of 8.6K output tokens. The 85 greps returned about 60K tokens of payload but cost about 3.7M units (22% of the session), around 60 times their payload. Cost is a function of turn count, so "read less" matters less than "make fewer calls".
3. This supports "mechanise verification": about 160 of 294 calls were verification sweeps. One script returning only failures would replace many of them.

**Limits of this proxy:**
- It covers one session of one kind (docs reconciliation).
- Usage is taken last-wins per message id. Streaming may undercount output.
- Thinking tokens are hidden and inferred.
- Carry is modelled as uniform. Even after the compaction adjustment, tool I/O explains only about 56M of 128M cache-read tokens. The rest is attachments, summaries and system context.
- Subagent usage is absent from the file.
- `cost-state` records a different fragment (a fraction of the cache-read total), so I do not use its dollars.
- Multipliers are assumptions.

## 3. Proposal overhead and break-even (modelled, assumptions in `model.py`)

Overhead per session, medium scenario at 250K average context and 150 calls:

| Item | units |
|---|---|
| 4 extra calls (`ledger open`, `ledger close`, one ledger-validator fix cycle, one `kit context`) | about 100K |
| Entry authoring: about 2.5K output tokens plus reading the template | about 45K |
| 5 dispositions plus reading each pattern | about 67K |
| **Total** | **about 212K** |

The extra calls are the largest part. A hook or script that runs these inside the existing gate call would cut about half of it. Index regeneration costs no model tokens. Front matter on 24 patterns is a one-off of about 4K tokens, plus a validator.

The saving is a smaller chain, assumed to go from 42K to 22K tokens, worth about 325K units at 150 calls.

| Scenario | Net per session, cached | Net per session, uncached | Break-even (build assumed at 5.5 builder sessions) |
|---|---|---|---|
| Small (15K chain, 60 calls, 60K context) | **−42K** | −272K | never |
| Medium (Jayshankar-like) | +113K | +1.1M | about 290 sessions cached, about 28 uncached |
| Large/long (observed) | +1.0M | +9.9M | about 90 sessions cached, about 9 uncached |

Per N agents in the medium case (adding avoided merge conflicts at about 85K units each):

| Agents | Net per round |
|---|---|
| 1 | +113K |
| 3 | +509K |
| 6 | +1.1M |

Parallelism earns its benefit through **conflict avoidance on shared logs**, not through smaller reads. That is a much cheaper mechanism than the full ledger.

Reconciler map-then-reduce costs 13–26K units for 1–6 entries, against 3–20K to read the entries directly. A 60-line entry is only about 1K tokens, so map-reduce does not pay below roughly 20–30 entries.

**Not worth it:** a solo small project; per-kit_ref dispositions in short sessions (the overhead exceeds the benefit unless a pattern would otherwise have been reinvented); the reinvention-rate metric with one consumer; front matter beyond `triggers` and `not_when` before a second consumer; map-reduce below about 20 entries.

## 4. Prompt caching

**Assumptions:** Anthropic-style prefix caching with a 5-minute TTL; other providers differ.

- **Within one cached harness**, a token read once costs about 1.25 plus 0.1 per later turn: about 11 units over 100 turns, or about 2 output tokens. Reading is expensive relative to writing only for tokens retained across many turns. The drafts' "caching does nothing across harnesses" is half right. It gives no cross-harness sharing (different system prompts mean different prefixes), but it already discounts the repeat reads inside each harness.
- **Uncached or expired cache** (a human relay pausing more than 5 minutes, GUI apps, harnesses that do not cache): carry is about 10 times worse, and reading outweighs writing roughly 170 to 1. This is where the "reading dominates" claim is strongest. In the cost model it moves break-even from about 290 sessions to about 28 for the medium case.
- **Subagent reading** starts cold but keeps its payload out of the main context's carry. This is a cheap lever the drafts omit.

## 5. "Cheap model renders the mechanical parts"

I split 172 sentences from 10 BUILDER decisions (#12, 25, 38, 47, 58, 66, 71, 77, 85, 92) by hand. The classes are S (derivable by script from git or tests), D (describable by someone reading the diff) and J (judgement or transcript-only).

| Class | Sentences | % | % by chars |
|---|---|---|---|
| S | 18 | 10% | 8% |
| D | 65 | 38% | 37% |
| J | 89 | 52% | 55% |

- Only S is truly mechanical. D needs a model, either the one that already holds the context or a cheaper one fed a facts file and diff. The facts file is nearly as long as the sentence it replaces, so the hand-off eats much of the saving.
- Debugging narrative ("re-investigated, tested the email path, isolated it…") exists only in the transcript. It is not derivable from git and counts as J. The `Verified` and `Cross-reference` lines are S.
- Saving: doc writing is about 6–8% of a docs-heavy session, and less in a code session. 0.08 × (0.08 + 0.37 × 0.75) is about 2.9%, minus hand-off cost, so about 2%. The draft's own claim ("smallest slice") is confirmed, and the gain is not worth the fidelity risk it names.
- Caveat: the labels are my judgement. A ±10-point D/J shift changes the conclusion by less than 1% of session cost.

## 6. Problems, ranked

- **High:** the drafts model neither turn count nor the carry cost. Extra round trips (open, close, `kit context`, validator loops) cost more than the pattern text they replace. *Fix:* the ledger and validator must run inside existing gate and commit hooks. Record per-session token and call totals from the harness so that pilots measure.
- **High:** the "4,500-line log re-read" evidence is wrong as stated (0 Reads, 56 targeted greps). *Fix:* reword `role-routed-records` §0 to cite the 56 round trips, not full reads.
- **Medium:** disposition-per-ref and the reinvention rate carry overhead of 20–140K units per session and measure nothing with one consumer. *Fix:* defer until a second consumer, and gate on `kit_refs` that match `not_when`.
- **Medium:** map-reduce is cost-parity or worse below about 20 entries. *Fix:* use a direct read, with a mechanical citation check on the output.
- **Low:** AGENTS.md says BUILDER decisions #67–#89 are a skipped hole, but `### Decision 67`–`89` headings exist contiguously in the file (`grep` verified). That is the motivating anecdote in two drafts, and it is either stale or about something else. *Fix:* check it before citing it.

## 7. What survives

- Mechanised drift and verification, with failures-only output. The session spent about 160 calls (about half of all calls) on checks a script can do.
- Facts-from-git for the ledger (S is 8–10% of sentences, and the `Verified` line plus counts are free).
- Per-record files, where N≥2, for conflict avoidance (+0.4M to +1M units per round at N=3 to 6).
- Cost reduction by shrinking SPEC §0 (24% of the chain) with a generated digest.

## 8. Unverified

- Real prices and caching behaviour per harness: check provider docs.
- Whether this single docs session generalises: re-run the transcript script on 2–3 build sessions (other `.jsonl` files exist) and compare.
- The size of the thinking-token share.
- Subagent costs.
- Whether a SPEC §0 digest cuts the chain without hurting comprehension: pilot with a comprehension check.

## 9. Top 5 changes first

1. A drift checker in `docs-guardian` that returns failures only (numbering across logs, "built/not built" against migrations on disk, refs resolving). It runs in one call and replaces the verification sweep.
2. Move ledger facts and token/call totals into commit trailers and a hook or `npm run` wrapper, so the model makes zero extra calls. Record harness usage at close so the pilot is measured.
3. A generated one-line-per-decision digest for SPEC §0 and a token budget on each AGENTS read list. Aim to cut the minimal chain from 42K to about 25K tokens, and measure it.
4. Make per-record log files opt-in when ORCHESTRATION declares N≥2 parallel agents. It is the proven conflict fix.
5. Document the convention that read and verify sweeps run in a subagent returning a digest. Defer dispositions, the reinvention rate, full front matter and the map-reduce reconciler until a second consumer or at least 20 entries.
