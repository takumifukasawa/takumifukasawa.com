// node scripts/diary/fetch.ts
//
// Puts the published diary into .content/ (gitignored) before the site builds. Where it comes from:
//   OBSIDIAN_VAULT=<path to the Obsidian vault>      local: convert straight from the vault (scripts/lib/diary.ts)
//   SITE_CONTENTS_REPO=<git@github.com:...> + SITE_CONTENTS_READ_KEY=<private key>
//                                                 CI: clone the private relay repo with its read-only deploy key
//   neither                                       local: build without the diary, with a warning
//                                                 CI (WORKERS_CI=1): fail, so the site is never deployed without it
// docs/plans/active/diary-pipeline.md
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { syncDiary } from '../lib/diary.ts';
import { repoRoot } from '../lib/lab.ts';

export const CONTENT_OUT = join(repoRoot, '.content');

export type Source = { kind: 'vault'; vault: string } | { kind: 'repo'; repo: string; key: string } | { kind: 'none'; fatal: boolean };

export const pickSource = (env: NodeJS.ProcessEnv): Source => {
  if (env.OBSIDIAN_VAULT) return { kind: 'vault', vault: env.OBSIDIAN_VAULT };
  if (env.SITE_CONTENTS_REPO && env.SITE_CONTENTS_READ_KEY)
    return { kind: 'repo', repo: env.SITE_CONTENTS_REPO, key: env.SITE_CONTENTS_READ_KEY };
  return { kind: 'none', fatal: env.WORKERS_CI === '1' };
};

const fromRepo = (repo: string, key: string) => {
  const tmp = mkdtempSync(join(tmpdir(), 'diary-'));
  try {
    const keyFile = join(tmp, 'key');
    // Build variables keep newlines as "\n" when pasted on one line; a key needs real ones and a final newline.
    writeFileSync(keyFile, `${key.replace(/\\n/g, '\n').trim()}\n`);
    chmodSync(keyFile, 0o600);
    const ssh = `ssh -i ${keyFile} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${join(tmp, 'known_hosts')}`;
    execFileSync('git', ['clone', '--depth', '1', '--quiet', repo, join(tmp, 'repo')], {
      env: { ...process.env, GIT_SSH_COMMAND: ssh },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    rmSync(CONTENT_OUT, { recursive: true, force: true });
    mkdirSync(CONTENT_OUT, { recursive: true });
    cpSync(join(tmp, 'repo', 'daily'), join(CONTENT_OUT, 'daily'), { recursive: true });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

const main = async () => {
  // Local machines keep OBSIDIAN_VAULT in .env (gitignored, docs/setup.md). Workers Builds sets real env vars instead.
  if (existsSync(join(repoRoot, '.env'))) process.loadEnvFile(join(repoRoot, '.env'));
  const source = pickSource(process.env);
  if (source.kind === 'vault') {
    const ids = await syncDiary(resolve(source.vault), CONTENT_OUT);
    console.log(`diary: ${ids.length} published days from the vault`);
  } else if (source.kind === 'repo') {
    fromRepo(source.repo, source.key);
    console.log('diary: fetched from the relay repo');
  } else if (source.fatal) {
    throw new Error(
      'SITE_CONTENTS_REPO / SITE_CONTENTS_READ_KEY are not set in this Workers Build. Set them under Settings > Builds > Variables and secrets ' +
        '(docs/plans/active/diary-pipeline.md, task 6). The deploy stops here so the site is not published without the diary.',
    );
  } else {
    rmSync(CONTENT_OUT, { recursive: true, force: true });
    mkdirSync(join(CONTENT_OUT, 'daily'), { recursive: true });
    console.warn('diary: OBSIDIAN_VAULT is not set, building without the diary (set it to the vault path in .env to include it)');
  }
};

if (import.meta.main) {
  main().catch((e: Error) => {
    console.error(`diary: ${e.message}`);
    console.error(
      'If the clone failed: is the deploy key still on the relay repo (Settings > Deploy keys), and is SITE_CONTENTS_REPO its SSH URL?',
    );
    process.exit(1);
  });
}
