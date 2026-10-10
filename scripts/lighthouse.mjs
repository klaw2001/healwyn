// Lighthouse on key pages with its default mobile emulation and throttling.
//
//   pnpm build && pnpm start            (in another terminal)
//   pnpm lighthouse                     (or BASE=https://your-site pnpm lighthouse)
//
// Reports go to .lighthouse/ (gitignored). Exits 1 if any score is below MIN (default 90).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const root = join(import.meta.dirname, '..');
const base = process.env.BASE ?? 'http://127.0.0.1:3000';
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/contact'];
const min = Number(process.env.MIN ?? 90);
const outDir = join(root, '.lighthouse');
mkdirSync(outDir, { recursive: true });

async function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    // Reuse Playwright's Chromium when available.
    const require = createRequire(join(root, 'apps/web/package.json'));
    const playwright = await import(require.resolve('@playwright/test'));
    return (playwright.chromium ?? playwright.default.chromium).executablePath();
  } catch {
    return undefined; // let chrome-launcher find a local Chrome
  }
}

const chrome = await chromeLauncher.launch({
  chromePath: await chromePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});

const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
let failed = false;
try {
  for (const path of paths) {
    const result = await lighthouse(`${base}${path}`, {
      port: chrome.port,
      output: ['html', 'json'],
      onlyCategories: categories,
      logLevel: 'error',
    });
    const [html, json] = result.report;
    const name = path === '/' ? 'home' : path.replace(/\W+/g, '-').replace(/^-|-$/g, '');
    writeFileSync(join(outDir, `${name}.html`), html);
    writeFileSync(join(outDir, `${name}.json`), json);

    const scores = Object.fromEntries(
      categories.map((id) => [id, Math.round((result.lhr.categories[id]?.score ?? 0) * 100)]),
    );
    const metrics = result.lhr.audits;
    console.log(
      `${path.padEnd(12)} ${categories.map((c) => `${c} ${scores[c]}`).join(' | ')}` +
        `  (LCP ${metrics['largest-contentful-paint']?.displayValue}, TBT ${metrics['total-blocking-time']?.displayValue}, CLS ${metrics['cumulative-layout-shift']?.displayValue})`,
    );
    for (const category of ['performance', 'accessibility', 'best-practices']) {
      if (scores[category] < min) failed = true;
    }
    // List failing audits that carry weight, to make fixing easy.
    for (const category of categories) {
      for (const ref of result.lhr.categories[category]?.auditRefs ?? []) {
        const audit = result.lhr.audits[ref.id];
        if (ref.weight > 0 && audit && audit.score !== null && audit.score < 0.9) {
          console.log(`    - [${category}] ${audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ''}`);
        }
      }
    }
  }
} finally {
  await chrome.kill();
}

console.log(`Reports written to ${outDir}`);
if (failed) {
  console.error(`At least one performance, accessibility or best-practices score is below ${min}.`);
  process.exitCode = 1;
}
