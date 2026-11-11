# Prompt: STEERING-PROMPTS (the adaptive correction cards an LLM offers the user inline)

> **A catalogue the LLM reads and selects from — not a document handed to the
> user.** When a session runs `prompts/NEW-PROJECT.md` or
> `prompts/CONTINUE-TINS-PROJECT.md`, it surfaces short, ready-to-paste prompts
> **inline, at the moment they are useful**, that the user can send back to pull
> the session onto the rails. Most importantly: the moment the model corrects
> itself.
>
> **Source:** D34 (session 16). The user was offered a static deck-file and
> declined it, asking instead for "inline comments that change appropriately
> based on how the user uses tins-kit." Adaptation is therefore the requirement,
> not a nicety.

---

## 0. Why this exists

A long TINS session drifts in ways the user cannot see. The model describes a
file it last read forty turns ago. It quietly widens the W. It states a version
number it never checked. It notices, halfway through a recheck, that it had a
decision backwards — and silently fixes it, which looks from outside exactly
like nothing happened.

The user is usually the only one who could catch this, and they are the one with
the least information. They do not know which artefact the model skipped, or
that a recheck contradicted an earlier answer. By the time drift is visible in
the output, it is expensive.

So the model hands the user the steering wheel at the moments steering is
possible: a short prompt, in context, that they can paste back to force the
correction. Two properties make this work, and dropping either kills it.

**It is inline and timely.** A file of correction prompts is a file nobody
opens. The card has to appear in the conversation at the moment the drift
happens.

**It is adapted.** A card that says "please re-read the relevant files" teaches
the user to skim past the mechanism. A card that says "re-read §4.2 of SPEC.md
and D14 before continuing W7 — you just described the schema without opening
it" is a usable instrument. **Generic cards are worse than no cards.**

---

## 1. The adaptation rule

Every card is a function of three inputs. Fill all three before emitting one.

**1. Which scenario the session is in.** Scenario 1 (`NEW-PROJECT.md`) is
pre-spec — drift means the interview is being skipped or the spec is being
drafted from assumptions. Scenario 3 (`CONTINUE-TINS-PROJECT.md`) is post-spec —
drift means the locked spec is being contradicted, the W is widening, or the
gate is being avoided. The same drift class produces a different card in each.

**2. Where the project actually is.** Its mode (A/B/C), the current W, which
files and decisions are live right now. This is what supplies the specifics —
name the real `D14`, the real `§4.2`, the real `W7`, the real
`src/lib/prisma.ts`.

**3. What just happened.** The drift class from §3, and the concrete instance of
it — not "I may have been imprecise", but the actual claim, file, or decision at
issue.

Then write the card in **the user's voice, ready to paste**, one to three
sentences, naming the artefact. A card the user has to edit before sending is a
card they will not send.

**Volume discipline:** at most two cards at a checkpoint, one after a
self-correction. This is an instrument, not a footer. If everything is a card,
nothing is.

---

## 2. When to emit

| # | Checkpoint | Emit |
|---|---|---|
| 1 | After the interview (Scenario 1) or W selection (Scenario 3) | 1–2 cards for the drift classes most likely in the work just scoped |
| 2 | At the start of each W | 1 card, pinned to that W's specific risk |
| 3 | **Immediately after any self-correction or recheck that changed an earlier answer** | 1 card. **Mandatory, and immediate** |
| 4 | Before running the gate | 1 card if anything went unverified |
| 5 | Before handover / stopping | 1 card if any assumption is still standing |

**Checkpoint 3 is the one that matters most, and the one most likely to be
skipped.** The natural behaviour on noticing your own error is to fix it quietly
and carry on — the correction feels like housekeeping, and mentioning it feels
like drawing attention to a mistake. But a silent self-correction is precisely
the event the user cannot see and therefore cannot steer. So: **say the
correction out loud, name what you had wrong and what is now right, then offer
the card.** If you corrected yourself once, the same stale context is probably
behind other claims in that stretch — that is what the card is for.

---

## 3. The card catalogue

Each entry gives the trigger, the card's raw shape with `{{slots}}`, and a
worked adaptation. **Never emit the raw shape.** Fill every slot from real
project state, or drop the card.

### 3.1 Self-correction — the model contradicted itself on a recheck

*Trigger: you just discovered an earlier statement of yours was wrong.*

> Raw: `You just corrected yourself on {{what}}. Go back over everything you told
> me about {{area}} since {{point}} and re-verify each claim against the actual
> files — tell me which other ones were built on the same wrong assumption.`

> Adapted: *"You just corrected yourself on which table holds `tenant_id`. Go
> back over everything you told me about the schema since we started W7 and
> re-verify each claim against `prisma/schema.prisma` — tell me which other ones
> were built on the same wrong assumption."*

### 3.2 Stale recall — describing a file or decision without re-reading it

*Trigger: you asserted the contents of a file or decision you have not opened
this session, or opened long ago.*

> Raw: `Re-open {{file}} and {{decision}} before you continue. Quote the lines
> you're relying on, then tell me if what you just said still holds.`

> Adapted: *"Re-open `src/lib/prisma.ts` and D14 before you continue. Quote the
> lines you're relying on, then tell me if `withTenantTx` really behaves the way
> you just described."*

### 3.3 Scope creep — work drifting past the locked W

*Trigger: you are touching files or behaviour the current W does not cover.*

> Raw: `{{W}} is scoped to {{scope}}. You're now working on {{drift}}. Is that
> inside the W, or should it be a separate one? Don't start it until we've
> decided.`

> Adapted: *"W7 is scoped to the audit-log trigger. You're now refactoring the
> auth middleware. Is that inside W7, or should it be W8? Don't start it until
> we've decided."*

### 3.4 Spec bypass — code moving ahead of the spec

*Trigger: you are about to write or change behaviour the spec does not describe.*

> Raw: `Under TINS the spec is the source. What you're about to build isn't in
> {{section}}. Amend SPEC.md first and show me the diff, or tell me why this
> doesn't need one.`

> Adapted: *"Under TINS the spec is the source. Retry-with-backoff on the outbox
> worker isn't in §4.3. Amend SPEC.md first and show me the diff, or tell me why
> this doesn't need one."*

### 3.5 Unearned confidence — a factual claim with nothing behind it

*Trigger: you stated a version, a limit, an API shape, or a number you did not
verify this session.*

> Raw: `You stated {{claim}} as fact. Did you verify it this session, or is that
> from memory? Check it and cite the source, or mark it as an assumption.`

> Adapted: *"You stated that Prisma 6 supports `$extends` on interactive
> transactions as fact. Did you verify it this session, or is that from memory?
> Check it and cite the source, or mark it as an assumption."*

### 3.6 Silent assumption — a gap filled without flagging it

*Trigger: something was underspecified and you chose, without saying so.*

> Raw: `List every assumption you've made in {{area}} that I didn't confirm.
> For each one, tell me what breaks if it's wrong.`

> Adapted: *"List every assumption you've made about the vendor-rep permission
> model in W7 that I didn't confirm. For each one, tell me what breaks if it's
> wrong."*

### 3.7 Gate avoidance — approaching a stop without a green gate

*Trigger: you are wrapping up, and validate/typecheck/build/test has not been
run since the last change.*

> Raw: `Before we stop: run {{gate}} and paste the actual output. If it's not
> green, we're not done — don't update HANDOVER.md yet.`

> Adapted: *"Before we stop: run `node tins-kit/scripts/validate.mjs --spec
> SPEC.md && npm run build` and paste the actual output. If it's not green,
> we're not done — don't update HANDOVER.md yet."*

---

## 4. What you do NOT do

- **Don't emit a raw card.** Every `{{slot}}` filled from real project state, or
  no card at all. A generic card trains the user to ignore the mechanism.
- **Don't act on a card yourself.** Cards are offered, never auto-executed
  — the user pastes one if they want it. Answering your own card, or doing
  what it asks pre-emptively, defeats the point: the user's judgement is the
  instrument, and you are handing them the handle.
- **Don't emit cards on a schedule.** Only at §2's checkpoints and triggers.
- **Don't skip checkpoint 3** because the correction was small or because
  mentioning it feels like admitting a mistake. That is the checkpoint the whole
  mechanism is built around.
- **Don't stack more than two cards** at once.
- **Don't soften a card into a rhetorical question.** "Would you like me to
  re-read the schema?" is not a card. The card is text the user sends to *you*.
- **Don't invent drift** to have something to offer. No drift, no card.

---

## 5. What success looks like

1. Every card named a real file, decision id, W, or claim from this project.
2. Every self-correction was said out loud and immediately followed by a card.
3. At most two cards at a checkpoint; one after a self-correction.
4. Cards were offered and left alone — never executed by the model.
5. Each card was paste-ready in the user's voice, needing no editing.
6. Cards appeared at §2's checkpoints, not sprinkled through the transcript.

---

*— End of `STEERING-PROMPTS.md`. See also: `prompts/NEW-PROJECT.md` (Scenario 1)
and `prompts/CONTINUE-TINS-PROJECT.md` (Scenario 3), both of which emit these.*
