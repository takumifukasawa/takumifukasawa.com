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
import { syncSite } from '../lib/diary.ts';
import { repoRoot } from '../lib/lab.ts';

export const CONTENT_OUT = join(repoRoot, '.content');

// A private key as pasted into a build variable may have lost its line breaks: they come back as spaces, or as
// literal "\\n". ssh then fails with "error in libcrypto". Rebuild the PEM: header, base64 in 70-column lines, footer.
export const normalizeKey = (raw: string): string => {
  const text = raw.replace(/\\n/g, '\n').trim();
  const m = text.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!m) return `${text}\n`;
  const body = m[2]!.replace(/\s+/g, '');
  return `-----BEGIN ${m[1]}-----\n${body.match(/.{1,70}/g)!.join('\n')}\n-----END ${m[1]}-----\n`;
};

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
    writeFileSync(keyFile, normalizeKey(key));
    chmodSync(keyFile, 0o600);
    const ssh = `ssh -i ${keyFile} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${join(tmp, 'known_hosts')}`;
    execFileSync('git', ['clone', '--depth', '1', '--quiet', repo, join(tmp, 'repo')], {
      env: { ...process.env, GIT_SSH_COMMAND: ssh },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    rmSync(CONTENT_OUT, { recursive: true, force: true });
    mkdirSync(CONTENT_OUT, { recursive: true });
    cpSync(join(tmp, 'repo', 'daily'), join(CONTENT_OUT, 'daily'), { recursive: true });
    // Both sections must be there: a relay without blog/ would publish a site with no blog at all.
    for (const section of ['daily', 'blog'])
      if (!existsSync(join(tmp, 'repo', section)))
        throw new Error(`the relay repo has no ${section}/. Run the vault's "publish site contents" workflow, then build again.`);
    cpSync(join(tmp, 'repo', 'blog'), join(CONTENT_OUT, 'blog'), { recursive: true });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

const main = async () => {
  // Local machines keep OBSIDIAN_VAULT in .env (gitignored, docs/setup.md). Workers Builds sets real env vars instead.
  if (existsSync(join(repoRoot, '.env'))) process.loadEnvFile(join(repoRoot, '.env'));
  const source = pickSource(process.env);
  if (source.kind === 'vault') {
    const { daily, blog } = await syncSite(resolve(source.vault), CONTENT_OUT);
    console.log(`site contents: ${daily.length} days, ${blog.length} blog posts from the vault`);
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
    if (pickSource(process.env).kind === 'repo')
      console.error(
        'If the clone failed: is the deploy key still on the relay repo (Settings > Deploy keys), and is SITE_CONTENTS_REPO its SSH URL?',
      );
    process.exit(1);
  });
}
