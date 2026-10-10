// Netlify scheduled function: runs the nurture worker every five minutes by
// calling the CRM's own endpoint. Needs CRON_SECRET in the site's environment.
import type { Config } from '@netlify/functions';

export default async () => {
  const base = process.env.URL;
  if (!base || !process.env.CRON_SECRET) return new Response('not configured', { status: 500 });
  const response = await fetch(`${base}/api/cron/nurture`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return new Response(await response.text(), { status: response.status });
};

export const config: Config = { schedule: '*/5 * * * *' };
