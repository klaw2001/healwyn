import { runNurtureWorker } from '@healwyn/messaging/worker';
import { NextResponse, type NextRequest } from 'next/server';
import { system } from '@/lib/server/db';
import { bearerMatches } from '@/lib/server/webhooks';

/**
 * Runs one pass of the nurture worker. Call it on a schedule (Netlify
 * scheduled function, Supabase pg_cron + pg_net, or any cron) with
 * `Authorization: Bearer $CRON_SECRET`. Safe to call concurrently.
 */
export async function POST(request: NextRequest) {
  if (!bearerMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  try {
    const result = await runNurtureWorker({ sql: system() });
    console.info(JSON.stringify({ level: 'info', event: 'worker.pass', ...result }));
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'worker.failed',
        error: error instanceof Error ? error.name : 'unknown',
      }),
    );
    return NextResponse.json({ error: 'worker_failed' }, { status: 500 });
  }
}
