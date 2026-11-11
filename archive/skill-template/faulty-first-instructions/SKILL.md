---
name: faulty-first-instructions
description: |
  Generate step-by-step tutorial / lab / capstone instructional content using the
  "faulty-first, then corrected" teaching pattern. Each step shows: the most
  common mistake (intentionally), the error it produces, why it's wrong, the
  corrected version, and the expected output. Designed for technical topics
  where students learn by seeing failure modes BEFORE the fix.

  Use this skill when:
  - Writing a tutorial, lab, or capstone for a coding topic
  - Writing step-by-step setup guides (npm/pip install, environment config)
  - Writing API integration walkthroughs (auth, endpoints, SDK calls)
  - Writing a "first project" / "build a thing" guide
  - The student is expected to TYPE / RUN something, not just READ
  - There are common mistakes worth teaching by example

  Do NOT use this skill when:
  - The content is purely conceptual or theoretical
  - The content is a reference card / cheat sheet (no "steps")
  - The content is a one-liner or quick tip
  - There are no realistic failure modes to demonstrate
---

# Skill: Faulty-First Instructions

## What this skill does

This skill generates step-by-step instructional content for any technical topic using a specific teaching pattern: **for every milestone, the instruction first shows the most common mistake, the error it produces, the diagnosis, then the corrected version**.

The pattern is the same one used in the MERN TODO walkthrough (see `MERN-TODO-EXAMPLE.md` in the user's `teacher-prep/templates/` folder). The pedagogy: students see the failure mode BEFORE the fix, so they can recognize it in their own work later.

## When to invoke this skill

**Invoke this skill when the user asks for:**
- A tutorial, lab, walkthrough, or capstone for a technical topic
- "Write me instructions for [topic]"
- "Build a [thing] tutorial"
- "How do I teach [X] step by step"
- "Generate content for my class on [Y]"

**Don't invoke when:**
- The user wants a cheat sheet, quick reference, or one-pager
- The user wants purely conceptual/theoretical content
- The user wants a code review (different skill)
- The user wants a debugging session (different skill)

## Inputs

The skill needs:

1. **Topic** — what is the user building / teaching? (e.g., "MERN chatbot with Azure OpenAI", "Python web scraper with BeautifulSoup")
2. **Audience** — who is the student? (e.g., "12th-grade BCA students with no prior AI experience", "experienced engineers new to Azure")
3. **Final goal** — what should the student be able to do at the end? (e.g., "deploy a working chatbot to a free cloud platform", "scrape 100 pages into a CSV")
4. **Environment** — what tools / OS / versions? (e.g., "Node 20 on Windows, Python 3.10", "any OS, Node 20")
5. **Time budget** — how long should the instructions take to complete? (e.g., "2 hours", "6 hours class block", "1 week self-paced")

Optional:
- The existing instructor's `MERN-TODO-EXAMPLE.md` style reference (if you have access to the user's workspace, check `teacher-prep/templates/`)
- Specific tech stack constraints (e.g., "must use free-tier services only")

## Output

A single markdown file containing:
- Title and 1-paragraph summary
- The 5-milestone roadmap (high level)
- For each milestone: the faulty-first pattern (broken → diagnosis → fix)
- A "common mistakes recap" table at the end
- A verification checklist
- Optional: 5-5-5 journal entry template

## The pattern: "faulty-first, then corrected"

For every step, the structure is:

```
### STEP N: [Milestone name]

#### ⚠️ Faulty version (the most common mistake)
[code/command/config with the intentional mistake]

#### ❌ What happens
[error message OR wrong behavior]

#### 💡 Why it's wrong
[short explanation of the cause]

#### ✅ Corrected version
[code/command/config that fixes it]

#### 🎯 Expected output (after the fix)
[what success looks like]
```

The student runs the ⚠️ version, sees the ❌, understands the 💡, then runs the ✅ version and gets the 🎯. This is the "see it fail, fix it" loop.

## Procedure (how to generate the output)

When invoked, follow this procedure:

### Step 1: Establish scope
Before writing anything, nail down:
- **Topic** (1 sentence): what is this about?
- **Audience** (1 sentence): who is the student?
- **Final goal** (1 sentence): what can they do at the end?
- **Time budget**: how long should this take?
- **Stack constraints**: any hard requirements?

If the user didn't specify all of these, ask. Don't guess the audience — a 12th-grader and a senior engineer need very different instructions.

### Step 2: Design the milestone roadmap
Break the topic into **5-10 milestones**. Each milestone is a checkable, demonstrable state. Examples:
- "Project folder created and version-controlled"
- "Backend server returns a 200 on /api/health"
- "Frontend renders a chat UI"
- "Azure OpenAI integration works locally"
- "Deployed to a free platform"

For each milestone, identify:
- What does "done" look like? (concrete, testable)
- What's the most common mistake at this step? (the faulty version)
- What's the corrected version?
- What's the expected output?

### Step 3: For each milestone, write the 5-part block
Using the pattern from "The pattern" section above:
1. ⚠️ Faulty version (with the common mistake baked in)
2. ❌ What happens (real error message, not made up)
3. 💡 Why it's wrong (1-2 sentences)
4. ✅ Corrected version (the fix)
5. 🎯 Expected output (what success looks like)

**Critical rule:** the error in step 2 MUST be what actually happens when you run step 1. Don't invent errors. If you're not sure, search the docs or run the code yourself.

### Step 4: Add "common mistake" callouts throughout
Beyond the per-step faulty versions, sprinkle in inline "common mistake" callouts wherever there's a realistic second-order mistake. Use a quote block:
```
> **Common mistake:** [what they often get wrong]
> **Fix:** [the right way]
```

### Step 5: Build the verification checklist
At the end, a markdown checklist of "must work before you call this done":
- [ ] Each milestone completed
- [ ] Each step's expected output matches
- [ ] No common mistakes left unfixed
- [ ] Final goal demonstrably achievable

### Step 6: Add the 5-5-5 journal template (if audience is a student)
If the audience is a student (not an experienced engineer), include a journal entry template at the end:
```
1. One thing I demoed today that I want to understand better
2. One thing that surprised me
3. One connection to something I already know
4. One thing I'd do differently
5. One question I couldn't answer
```

This is the "5-5-5 rule" — 5 sentences, 5 minutes, end of day.

## Output template

Use this exact structure when generating the file:

```markdown
# [Topic] — Faulty-First Walkthrough

## What you're building
[1-2 sentences: topic + final goal]

## Audience
[1 sentence: who this is for]

## Time budget
[How long this should take]

## The 5-milestone roadmap
1. [milestone 1] — [what "done" looks like]
2. [milestone 2] — [what "done" looks like]
3. [milestone 3] — [what "done" looks like]
4. [milestone 4] — [what "done" looks like]
5. [milestone 5] — [what "done" looks like]

## The pattern
For each step, you'll see:
1. ⚠️ The faulty version (the most common mistake)
2. ❌ What happens when you run it
3. 💡 Why it's wrong
4. ✅ The corrected version
5. 🎯 Expected output (after the fix)

You'll often run the ⚠️ version, see the ❌, understand the 💡, then run the ✅. This is intentional.

---

## STEP 1: [Milestone name]

### ⚠️ Faulty version
```[language]
[code with the intentional mistake]
```

### ❌ What happens
```
[exact error message OR description of wrong behavior]
```

### 💡 Why it's wrong
[1-2 sentences explaining the cause]

### ✅ Corrected version
```[language]
[correct code]
```

### 🎯 Expected output
[what success looks like — file created, command output, UI rendered, etc.]

---

## STEP 2: [Milestone name]
[same 5-part structure]

---

## STEP 3: ...
[etc.]

---

## Common mistakes recap

| Mistake | Symptom | Fix |
|---|---|---|
| ... | ... | ... |

## Verification checklist
- [ ] ...
- [ ] ...
- [ ] ...

## 5-5-5 (end of day)
1. One thing I demoed today that I want to understand better: ___
2. One thing that surprised me: ___
3. One connection to something I already know: ___
4. One thing I'd do differently: ___
5. One question I couldn't answer: ___
```

## Worked example

The canonical example is `MERN-TODO-EXAMPLE.md` in the user's `teacher-prep/templates/` folder. It demonstrates the pattern in full. A 1-step excerpt:

```markdown
## STEP 3: CREATE THE BACKEND

### ⚠️ Faulty version
```
npm run server.js
```

### ❌ What happens
```
npm error Missing script: "server.js"
npm error
npm error To see a list of scripts, run:
npm error   npm run
```

### 💡 Why it's wrong
`npm run` looks for a script defined in `package.json`. "server.js" isn't a script, it's a file. The right command to run a JS file is `node server.js`, not `npm run server.js`.

### ✅ Corrected version
```
node server.js
```

### 🎯 Expected output
A different error (about ES modules). See STEP 4 for the next fix. The pattern: every correction surfaces the next problem; that's how debugging works.
```

This is the pattern. **The "expected output" of the corrected version is often ANOTHER error** — because in real debugging, fixing one issue reveals the next. This is a feature, not a bug.

## Style rules

When generating the output:

1. **Match the user's existing style if you have it.** Check `teacher-prep/templates/` for `MERN-TODO-EXAMPLE.md` and `INSTRUCTION-STYLE-GUIDE.md` for the style contract.
2. **Don't make up errors.** The error in step 2 must be what actually happens. If unsure, run the code.
3. **Don't over-explain.** The "why" should be 1-2 sentences, not paragraphs.
4. **Use markdown code blocks with language hints** (` ```python `, ` ```bash `, ` ```javascript `, etc.).
5. **Real URLs and file paths.** No placeholders like `<file>` — use actual values.
6. **Add ✅/❌/⚠️/💡/🎯 visual markers** for the 5 parts of each step.
7. **For Windows, PowerShell, Node, Python specifics** — call them out explicitly. Don't assume Unix.
8. **For multi-step "fix" sequences** (where the fix surfaces another error), the "expected output" of step N is the error of step N+1. This is fine and intentional.

## Quality gates (before delivering)

Before sending the output, verify:

- [ ] The pattern is followed for EVERY step (no steps that just say "type this" without showing the faulty version first)
- [ ] Every ⚠️ version actually produces the ❌ output described (run it to verify)
- [ ] Every ✅ version actually produces the 🎯 output described (run it to verify)
- [ ] The "why" is accurate (not hand-wavy)
- [ ] The verification checklist matches the actual final goal
- [ ] File paths, URLs, and commands are all real (no placeholders)
- [ ] The total time estimate matches the milestone count (rough: 30-45 min per milestone)

## What to deliver

A single markdown file. Save it to a sensible location:
- If the user gave a workspace path: `teacher-prep/[topic-slug].md` or similar
- If the user asked for a template: `templates/[topic-slug].md`
- If the user is going to publish it: ask where

After saving, send the file as a media deliverable so the user can open it.

## Anti-patterns to avoid

- **Don't give the "correct" version first** and then say "here's what you might have done wrong." The whole point is the fault-then-fix loop. Start with the broken thing.
- **Don't add commentary like "this is intentional"** outside the section. Let the ⚠️ marker do the work.
- **Don't use fake / invented error messages.** If you don't know the real error, run the code and find out.
- **Don't add steps that don't have a faulty version.** Every step has a realistic mistake. If it doesn't, the step doesn't belong.
- **Don't over-engineer the "why."** 1-2 sentences. The student is in flow, not reading a textbook.
- **Don't skip the expected output.** Students need to know what success looks like to know if they got there.

## Quick reference: the 5-part step

| Part | Marker | Purpose |
|---|---|---|
| Faulty version | ⚠️ | The most common mistake, baked in |
| What happens | ❌ | The real error / wrong behavior |
| Why | 💡 | 1-2 sentences on the cause |
| Corrected version | ✅ | The fix |
| Expected output | 🎯 | What success looks like |

**Every step. Every time. No exceptions.**

## Notes for the AI using this skill

- This skill produces LONG outputs. That's fine. The user is paying for thoroughness.
- The student will likely run the code as they read. So:
  - The ⚠️ version must be copy-pasteable and runnable
  - The ✅ version must be copy-pasteable and runnable
  - The 🎯 output must be copy-paste-recognizable when the student sees it
- If the topic is so simple it doesn't have natural failure modes (e.g., "print hello world"), this skill is overkill. Use a normal quick-start.
- The "5-5-5 journal" at the end is OPTIONAL but recommended for student audiences.

End of skill.
