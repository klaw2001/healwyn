import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND } from '../src';

const repoRoot = join(import.meta.dirname, '../../..');
const SCAN_DIRS = ['packages', 'apps'];
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'test-results',
  'playwright-report',
  '__pycache__',
  '.venv',
]);
const CODE_FILE = /\.(ts|tsx|js|mjs|cjs|css|sql|py|json)$/;
const ALLOWED = new Set(['packages/core/src/brand.ts']);
// Generated from BRAND by `pnpm contracts` (the voice script data file).
const GENERATED = /^packages\/core\/contracts\//;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (CODE_FILE.test(entry)) yield path;
  }
}

/**
 * User-visible brand text must come from BRAND. Lowercase forms (the @healwyn/*
 * package scope, database names) are internal identifiers and are allowed.
 */
describe('brand name', () => {
  it('is only hardcoded in packages/core/src/brand.ts', () => {
    const offenders: string[] = [];
    const pattern = new RegExp(`\\b${BRAND.shortName}\\b`);
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(repoRoot, dir))) {
        const rel = relative(repoRoot, file);
        if (ALLOWED.has(rel) || GENERATED.test(rel) || rel.endsWith('package.json')) continue;
        if (pattern.test(readFileSync(file, 'utf8'))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
