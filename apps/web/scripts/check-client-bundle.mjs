// Fails the build if a server-only secret or module reaches browser bundles.
// Checks the names of secret variables, their current values (when set), and
// server-only database code.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import nextEnv from '@next/env';

// Load the same root .env the app uses, so real secret values are checked too.
nextEnv.loadEnvConfig(join(import.meta.dirname, '../../..'), false, { info: () => {}, error: console.error });

const staticDir = join(import.meta.dirname, '../.next/static');
const SECRET_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'RESEND_API_KEY',
  'RATE_LIMIT_SALT',
  'GEMINI_API_KEY',
  'LIVEKIT_API_SECRET',
];
const MARKERS = ['submit_lead', 'hit_rate_limit', 'service_role', ...SECRET_VARS];
const values = SECRET_VARS.map((name) => process.env[name]).filter((value) => value && value.length >= 8);

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|css|json|txt|map)$/.test(entry)) yield path;
  }
}

const problems = [];
for (const file of files(staticDir)) {
  const content = readFileSync(file, 'utf8');
  for (const marker of MARKERS) if (content.includes(marker)) problems.push(`${file}: contains "${marker}"`);
  for (const value of values) if (content.includes(value)) problems.push(`${file}: contains a secret value`);
}

if (problems.length) {
  console.error('Client bundle check failed:\n' + problems.join('\n'));
  process.exit(1);
}
console.info(
  `Client bundle check passed: no server secrets (${values.length} values checked) or database code in .next/static.`,
);
