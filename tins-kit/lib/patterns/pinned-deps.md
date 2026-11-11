# `pinned-deps` — kit pattern

> **Anything that is generated, embedded, or environment-specific must be in `.gitignore` or
> in a manifest, never in the source-of-truth.** The pattern is the discipline of pinning
> dependencies, ignoring generated artifacts, and keeping "what ships" identical to "what
> was tested."
>
> **Source:** `atal-incubation/AGENTS.md` standing rule #3 (the no-commit list),
> `Data-cleaning-script/AI-cleaning workflow/v4/CleanStation.cs` (`EMBEDDED_RESOURCES` list
> kept in lockstep with the PowerShell `/resource:` flag), `incubos/package.json` (pinned
> `"next": "14.2.18"`, not `"^14.2.18"`).

---

## 0. Why this exists

Two failure modes recur in the user's reference projects:

1. **"Works on my machine" drift.** A consumer's `package.json` says `"next": "^14.2.0"`
   and the test passes, but a new contributor clones the repo, runs `pnpm install`, and
   gets `next@14.2.32` — which has a different default for a breaking-change flag, and
   the dev server crashes with a 30-minute debugging session.
2. **Generated artifacts in source control.** A contributor commits `node_modules/`
   (300 MB of churn), `.next/` (build cache), `.env.local` (a leaked API key), or the
   `/resource:` flag list in `CleanStation.cs` (which is *generated from* the
   `EMBEDDED_RESOURCES` array, not authored by hand).

Both failures are prevented by the same discipline: **pin, manifest, ignore.**

---

## 1. The 3 lessons, in detail

### Lesson 1 — Pin every dep to an exact version in `package.json`

```jsonc
// .package.json (consumer)
{
  "dependencies": {
    "next": "14.2.18",            // not "^14.2.18", not "~14.2.0"
    "react": "18.3.1",
    "prisma": "5.22.0",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "typescript": "5.5.4",
    "eslint": "8.57.0"
  }
}
```

**Why exact, not caret:** a `^14.2.18` allows `14.99.0` (any 14.x). The user has
shipped multiple consumer projects that broke on a `^` upgrade. Pin to the *exact* version
that the test suite passed against. Update with intent, not accidentally.

**Use `pnpm` over `npm`.** `pnpm` writes a `pnpm-lock.yaml` (deterministic) and
enforces the lockfile by default. `npm` does not, and the `package-lock.json` it writes
is silently lossy on `npm install` (it can drop the lockfile and re-resolve).

### Lesson 2 — `.gitignore` is non-negotiable; the kit ships a template

The kit's `templates/.gitignore` covers the 9 must-ignore categories:

```gitignore
# Build outputs
node_modules/
.next/
.turbo/
build/
dist/
out/

# Env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# OS / editor
.DS_Store
Thumbs.db
.vscode/
.idea/

# Test artefacts
coverage/
.nyc_output/

# Generated / embedded (per project)
# - Data-cleaning-script: /CleanStation.exe (built from CleanStation.cs)
# - atal-incubation: /uploads/ (S3 mirror, regenerated on boot)
```

The rule: **if a file is generated, it is in `.gitignore`. If it is authored, it is in
git. There is no third state.**

### Lesson 3 — Embedded / generated manifests stay in lockstep

`Data-cleaning-script/v4/CleanStation.cs` ships a C# single-file .exe with 6 PowerShell
scripts embedded as resources. The build pipeline (`build-bundle.ps1`) reads
`EMBEDDED_RESOURCES` from the C# file and the `/resource:` flag list from the .csproj —
and **both must be updated together**, or the build silently ships an old script.

The pattern for any "A is generated from B" pair:

```ts
// scripts/check-embedded-sync.mjs (template)
import { readFile } from 'node:fs/promises';

const csproj = await readFile('CleanStation.csproj', 'utf8');
const cs     = await readFile('CleanStation.cs', 'utf8');

const csprojFlags = [...csproj.matchAll(/<EmbeddedResource Include="([^"]+)"/g)].map(m => m[1]);
const csList      = [...cs.matchAll(/EMBEDDED_RESOURCES\s*=\s*\{([^}]+)\}/s)][0]?.[1]
                       .split(',').map(s => s.trim().replace(/"/g, ''));

const missing = csprojFlags.filter(f => !csList.includes(f));
if (missing.length) {
  console.error('EMBEDDED_RESOURCES is out of sync with .csproj:');
  for (const f of missing) console.error(`  - ${f}`);
  process.exit(1);
}
```

Add a `selftest` case that runs this script. If the list ever drifts, the gate fails
before the build ships.

---

## 2. The 3 known anti-patterns

### Anti-pattern 1 — `^` or `~` in version specs

```jsonc
// ❌ WRONG
"next": "^14.2.0"        // allows next@14.99
"prisma": "~5.22.0"      // allows prisma@5.22.99

// ✅ RIGHT
"next": "14.2.18"
"prisma": "5.22.0"
```

If you genuinely need a minor-version range, document *why* in `BUILDER-DECISIONS-REVIEW.md`
and add a `selftest` case that pins it.

### Anti-pattern 2 — Committing `node_modules/`, `.next/`, `.env*`

Even with `.gitignore` in place, sometimes a contributor force-adds (`git add -f`) a
file that should be ignored. The kit's `selftest` runs a `git ls-files | grep` against
the ignore list and fails if any of the 9 categories leak in. See
`scripts/validate.mjs` §8.3 (the "no-committed-generated-files" check).

### Anti-pattern 3 — Two sources of truth for "what's in the build"

Either the .csproj drives the build (and the C# `EMBEDDED_RESOURCES` array is generated
at build time), or the C# array drives the build (and the .csproj is generated). You
must not have both authored by hand. The `check-embedded-sync.mjs` script is a band-aid
for an existing dual-source; the long-term fix is to delete one and generate the other.

---

## 3. When this pattern changes

- **When the consumer's lockfile manager changes** (e.g. switching from `pnpm` to
  `bun`): update the `.gitignore` to match the new manager's output (`.bun.lockb` vs.
  `pnpm-lock.yaml`), and update the `selftest` to validate the new lockfile exists.
- **When the consumer starts using Docker**: the `.dockerignore` is *also* a pinned-deps
  manifest. It must ignore the same files as `.gitignore` plus the build context. Ship
  it next to the `Dockerfile`.
- **When the consumer starts embedding binary assets** (PDFs, fonts, audio): the
  `EMBEDDED_RESOURCES` style of "manifest-in-lockstep" applies. The kit's
  `check-embedded-sync.mjs` template generalises — point it at the new pair.

---

*— End of `pinned-deps` pattern. See also: `templates/.gitignore`,
`scripts/validate.mjs` §8.3.*
