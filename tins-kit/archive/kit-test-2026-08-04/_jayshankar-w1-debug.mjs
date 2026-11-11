// debug-defect.mjs — quick test
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pExecFile = promisify(execFile);
const VALIDATOR = 'C:/Users/user/Desktop/Jayshankar/scripts/validate.mjs';

async function testDefect(name, mutate) {
  const dir = await mkdtemp(join(tmpdir(), 'jayshankar-debug-'));
  await mkdir(join(dir, 'supabase/migrations'), { recursive: true });
  await mkdir(join(dir, 'supabase'), { recursive: true });

  const files = {
    spec: await readFile('C:/Users/user/Desktop/Jayshankar/SPEC.md', 'utf8'),
    migration: await readFile('C:/Users/user/Desktop/Jayshankar/supabase/migrations/0001_init.sql', 'utf8'),
    rls: await readFile('C:/Users/user/Desktop/Jayshankar/supabase/rls-policies.sql', 'utf8'),
    seed: await readFile('C:/Users/user/Desktop/Jayshankar/supabase/seed.sql', 'utf8'),
  };
  mutate(files);
  await writeFile(join(dir, 'SPEC.md'), files.spec);
  await writeFile(join(dir, 'supabase/migrations/0001_init.sql'), files.migration);
  await writeFile(join(dir, 'supabase/rls-policies.sql'), files.rls);
  await writeFile(join(dir, 'supabase/seed.sql'), files.seed);

  let code = 0;
  let stdout = '';
  try {
    ({ stdout } = await pExecFile('node', [VALIDATOR], { cwd: dir }));
  } catch (err) {
    code = err.code || 1;
    stdout = (err.stdout || '') + (err.stderr || '');
  }
  await rm(dir, { recursive: true, force: true });
  console.log(`\n=== ${name} (exit ${code}) ===`);
  console.log(stdout);
}

await testDefect('RLS not enabled on movements', (f) => {
  f.rls = f.rls.replace(
    'alter table public.movements enable row level security;',
    '-- altered table public.movements enable row level security;',
  );
});
