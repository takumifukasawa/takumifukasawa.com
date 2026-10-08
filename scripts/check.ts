// node scripts/check.ts <name>   run one repo check (registered in .harness/checks.sh)
import { checkLabBuildInSync, checkLabShellEmbedded, checkNoLargeFiles } from './lib/checks.ts';

const checks: Record<string, () => string[]> = {
  'lab-build-in-sync': checkLabBuildInSync,
  'lab-shell-embedded': checkLabShellEmbedded,
  'no-large-files': () => checkNoLargeFiles(),
};

const name = process.argv[2];
const run = name ? checks[name] : undefined;
if (!run) {
  console.error(`usage: node scripts/check.ts <${Object.keys(checks).join(' | ')}>`);
  process.exit(2);
}
const problems = run();
for (const problem of problems) console.log(problem);
process.exitCode = problems.length > 0 ? 1 : 0;
