# HANDOVER.md

> **The operational-state file for a TINS consumer.** One per project. Updated
> by every LLM session that works on the project. Read first by the next LLM
> session; without it, the next session re-derives the state from scratch.
>
> **Format:** the W-queue + state snapshot + gotchas + handover protocol.
> Numbered W-queue items (W1, W2, ...) are sequential, never reordered. Status
> emoji: ✅ done · 🔶 partial · ⏳ in progress · 🚫 blocked.
>
> **Last updated:** <YYYY-MM-DD>
> **Last worked on by:** <name>
> **Current queue position:** W<N>

---

## §1 — The 5-second state (read this first)

| Question | Answer |
|---|---|
| What is the project? | <one-line> |
| What's the current dev state? | <green / amber / red> |
| What was the last W to ship? | W<N-1> ✅ |
| What's the next W to start? | W<N> ⏳ |
| What's blocking? | <one-line or "nothing"> |

---

## §2 — Work queue (do top-down, don't reorder)

### W1 — <title>
**Goal:** <one-line>
**Read:** <files to read first>
**Change:** <what you'll do>
**Verify:** <how you'll know it worked>
**Done when:** <the one-line "W1 is complete when...">
**Status:** ✅ done <date> · 🔶 partial · ⏳ in progress · 🚫 blocked
**Notes:** <1–3 lines of "what surprised me">

### W2 — <title>
<same structure>

<add more W<N> items as needed>

---

## §3 — State snapshot (the "what is true today" list)

- **Dev server:** <up / down / N/A>
- **DB:** <connection string (last 4 only) / N/A>
- **Tests:** <last green: YYYY-MM-DD, N cases>
- **Build:** <last green: YYYY-MM-DD>
- **Deploy:** <where it is deployed, last deploy YYYY-MM-DD>
- **Users:** <how many real users, how many seed users>
- **Open issues:** <list of known bugs / WIP>

---

## §4 — Gotchas (the "I learned this the hard way" list)

Each gotcha: symptom → fix → how to reproduce.

### Gotcha #1 — <one-line title>
**Symptom:** <what the user sees>
**Fix:** <the 1–2 line fix>
**Reproduce:** <the minimal steps to trigger it>

<add more gotchas as needed>

---

## §5 — Handover protocol (mandatory before stopping)

1. **Update queue status:** `⏳` → `✅ DONE (YYYY-MM-DD)` or `🔶 PARTIAL`.
2. **Append new work** as `W<N+1>+` with the same Goal/Read/Change/Verify/Done format.
3. **Update the header** in HANDOVER: **Last updated** + **Last worked on by** +
   **Current queue position**.
4. **Update state snapshot (§3)** with anything that changed.
5. **Add gotchas to §4** — anything that cost you time goes here.
6. **Leave it green:** `pnpm typecheck` + `pnpm build` must pass.
7. **Do not delete history** — never remove completed W-items.

---

*— End of `HANDOVER.md` template. See also: `templates/AGENTS.md` (the 1-page
onboarding for the next LLM session), `tins-kit/HANDOVER.md` (the kit's own
self-application).*
