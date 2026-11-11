# AGENT-BRIEF.md — starting Jayshankar Mode B

> Read this first if you are picking up build work on Jayshankar, whether human or an AI
> coding agent. It orients you and points you at the real source documents — it is not itself
> the spec.

## 1. What already exists, working and deployed

Mode A (Demo) is complete: a 9-table Postgres schema on Supabase, full RLS, an append-only
audit log, FIFO batch tracking with cascade, 3 role-based dashboards, a PWA frontend on
Netlify. Read `README.md`, `HANDOVER.md`, and `AGENTS.md` in the repo root for the full
picture — do not treat anything below as replacing those. `AGENTS.md` §3 has non-negotiable
standing rules (never edit generated code to fix a defect — edit the spec and regenerate;
never bypass RLS; every schema change is a versioned migration). Follow them exactly as
written for this phase too.

## 2. What this phase adds

Client feedback after the Mode A demo materially expanded scope. The full decision trail is in
`SPEC-AMENDMENT-v2.md` — read it in full before writing any code or migration. In short: a
vendor-bill and receiving-confirmation flow (previously nonexistent), a physical
container-based shelf-life tracking system (replacing ad-hoc batch FIFO for stock in storage),
a lightweight CRM, per-sale payment/arrears tracking with proof of payment, reverse-sale
support, multi-store schema, GST-readiness on a dormant track, iOS + Android native apps via
Capacitor, and outbound WhatsApp messaging via a Supabase Edge Function.

**The single most important thing to understand before touching any code:** the container
model (`SPEC-AMENDMENT-v2.md` §B.2–B.4, §C.1–C.4) is the most structurally significant change
in this amendment and touches the existing, working FIFO/transfer/sale algorithms. Read §C.4
specifically — it documents and fixes a real timestamp bug in the *existing, already-deployed*
transfer algorithm (destination batches incorrectly reset their shelf-life clock to the
transfer time). Get this piece right before anything else; everything downstream (barcodes,
least-shelf-life selling, repack) depends on it.

## 3. Build order — do not build everything at once

Recommended sequence, each phase gated on the previous one's validator passing green (same
discipline as Mode A's W1–W6, per `HANDOVER.md` §5):

1. **Container model first** (§B.2–B.4, §C.1–C.4 of the amendment) — the foundation everything
   else sits on. Get the shelf-life-timestamp fix (§C.4) covered by a test before moving on;
   it's the easiest thing in this whole amendment to get subtly wrong.
2. **Bills + receiving confirmation** (§B.5–B.6) — Problem A/B. Soft-gated per D25 throughout.
3. **Customers + payments + reversal** (§B.7–B.9) — Problem D/E and the reverse-sale
   requirement. Payments' balance calculation must stay derived, never stored (D17) —
   `sales`/`customers` never reference each other circularly; a balance is a join, not a
   column.
4. **Repack** (§C.3) — depends on containers being solid first.
5. **Notifications + role history** (§B.10–B.11) — ship the core transactional subset from
   §F of the amendment, not the full taxonomy; the rest is explicitly deferred.
6. **Multi-store schema** (§B.1, D23) — build the schema and RLS now, but leave the UI/
   dashboard surface behind a feature flag (same pattern as `VITE_DEMO_MODE`) until a second
   store is real. Don't build UI for a store count of one that only matters at two.
7. **Infrastructure last, not first:** R2 + Edge Function for WhatsApp/photos, Looker Studio
   read-only role, GitHub Actions backup workflow. These are real work but don't block the
   schema/app work above and shouldn't be front-loaded.

**Explicitly not in this phase** (§D of the amendment) — do not build these without a separate,
explicit go-ahead: WhatsApp inbound automation, n8n, the super-admin cross-store approval
workflow, the full notification list, any self-hosted BI tool.

## 4. Standing gotchas, specific to this phase

- **Do not use Hermes Agent, or any LLM-agent-in-the-loop, for WhatsApp automation.** The
  outbound Edge Function path is deterministic and auditable; an agent interpreting inbound
  messages to decide database writes is a prompt-injection surface and a poor fit for a system
  whose whole design (audit log, RLS) depends on deterministic records. If inbound automation
  is ever greenlit in a future phase, it should still be a structured parse, not an LLM
  deciding what to write.
- **R2 access control is not automatic.** Supabase RLS does not reach into Cloudflare R2 —
  photo access needs presigned URLs minted by an Edge Function that checks the requester's
  role. Don't assume "it's in a bucket" means "it's access-controlled."
- **Every soft-gated field uses the same three-state pattern**: `none` / `pending_upload` /
  `uploaded` for photos, applied consistently across receiving confirmation, spoilage claims,
  and payment proof (D25). Don't invent a bespoke boolean for one of these and a different
  pattern for another.
- **Looker Studio's Postgres role needs Postgres-level RLS configured explicitly** — a direct
  Postgres connection bypasses Supabase's RLS layer unless RLS is set on the role itself, not
  just assumed from "it's read-only."
- **GitHub Actions is the backup cron, not a new VM** — Supabase's free tier has no automated
  backups at all; don't skip this thinking it's optional polish.

## 5. Documentation standard for this phase

The client has explicitly asked that documentation be verbose enough for a future maintainer
— human or another AI agent — to extend this app and manage its migrations without the
current developer in the loop. Concretely, not just "write more":

- Every migration gets a comment explaining **why**, not just what — continue the existing
  `BUILDER-DECISIONS-REVIEW.md` pattern for every decision made during this phase, without
  exception.
- The container/fill model needs its own plain-language section written directly into
  `SPEC.md` (not left in the amendment file) — assume the reader has never seen a fish
  wholesale operation, because the next one won't have.
- This is not extra work layered on top of building for an AI agent — it's the same
  requirement. An explicit, unambiguous spec is exactly what makes agent-driven
  implementation reliable in the first place.

## 6. When you finish a phase item

Follow `HANDOVER.md` §7's existing protocol unchanged: run the validator, update `HANDOVER.md`
(state snapshot, queue position), log the decision in `BUILDER-DECISIONS-REVIEW.md`. An
unrecorded finding is a finding the next session pays for again — same rule as always, now
covering a much bigger scope than Mode A did.
