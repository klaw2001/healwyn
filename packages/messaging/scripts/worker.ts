/**
 * Runs the nurture worker.
 *
 *   pnpm worker                 one pass, then exit (use from cron)
 *   pnpm worker --every 60      a pass every 60 seconds until stopped
 *
 * Connects with WORKER_DATABASE_URL (a login role in nurture_worker), falling
 * back to DATABASE_URL.
 */
import postgres from 'postgres';
import { runNurtureWorker } from '../src/worker';

const url = process.env.WORKER_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set WORKER_DATABASE_URL or DATABASE_URL.');
  process.exit(1);
}
const everyIndex = process.argv.indexOf('--every');
const every = everyIndex > -1 ? Number(process.argv[everyIndex + 1]) : 0;
const host = new URL(url).hostname;
const sql = postgres(url, {
  max: 2,
  prepare: false,
  onnotice: () => {},
  ssl: ['localhost', '127.0.0.1', '::1'].includes(host) ? false : 'require',
});

async function pass() {
  const started = Date.now();
  const result = await runNurtureWorker({ sql });
  console.info(JSON.stringify({ level: 'info', event: 'worker.pass', ...result, ms: Date.now() - started }));
}

try {
  await pass();
  while (every > 0) {
    await new Promise((resolve) => setTimeout(resolve, every * 1000));
    await pass();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
