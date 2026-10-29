// Kiem tra RLS offline: doc TAT CA migration SQL, dam bao moi bang co
// tenant_id deu co ENABLE + FORCE + policy tenant_isolation o mot migration.
// Bang platform (tenants, plans, subscriptions, subscription_invoices,
// platform_admins) khong co RLS theo thiet ke (chi app_platform) nen loai tru.
// Khong can DB that. Chay: pnpm --filter @spa-saas/db check-rls
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'prisma/migrations');
const dirs = readdirSync(migDir).sort();
let allSql = '';
for (const dir of dirs) {
  try {
    allSql += readFileSync(join(migDir, dir, 'migration.sql'), 'utf8') + '\n';
  } catch {
    // bo qua thu muc khong co migration.sql
  }
}

const PLATFORM_TABLES = new Set([
  'tenants',
  'plans',
  'subscriptions',
  'subscription_invoices',
  'platform_admins',
]);

function tablesWithTenant(sql) {
  const found = new Set();
  const re = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    if (/\btenant_id\b/.test(m[2]) && !PLATFORM_TABLES.has(m[1])) found.add(m[1]);
  }
  return [...found].sort();
}

function tablesWithRls(sql) {
  const enabled = new Set([...sql.matchAll(/ALTER TABLE (\w+) ENABLE ROW LEVEL SECURITY/g)].map((x) => x[1]));
  const forced = new Set([...sql.matchAll(/ALTER TABLE (\w+) FORCE ROW LEVEL SECURITY/g)].map((x) => x[1]));
  const policied = new Set([...sql.matchAll(/CREATE POLICY tenant_isolation ON (\w+)/g)].map((x) => x[1]));
  return [...enabled].filter((t) => forced.has(t) && policied.has(t)).sort();
}

const needed = tablesWithTenant(allSql);
const covered = tablesWithRls(allSql);
const missing = needed.filter((t) => !covered.includes(t));
console.log(`tables with tenant_id: ${needed.join(', ')}`);
console.log(`tables with RLS policy: ${covered.join(', ')}`);
console.log(`migration dirs: ${dirs.join(', ')}`);
if (missing.length > 0) {
  console.error(`RLS_MISSING: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('RLS check OK');
