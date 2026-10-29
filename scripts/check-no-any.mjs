import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const banned = [/\bany\b/, /@ts-ignore/];
const dirs = process.argv.slice(2);
let failed = false;
for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  const files = execSync(`find ${dir} -type f \\( -name '*.ts' -o -name '*.tsx' \\)`, { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  for (const file of files) {
    const text = execSync(`cat ${file}`, { encoding: 'utf8' });
    for (const pattern of banned) {
      if (pattern.test(text)) {
        console.error(`${file}: forbidden pattern ${pattern}`);
        failed = true;
      }
    }
  }
}
if (failed) process.exit(1);
console.log('no-any check OK');
