import postgres from 'postgres';

/**
 * Where migrations and seeds run. Two transports:
 * - DATABASE_URL: a direct Postgres connection (local, Supabase direct or pooler).
 * - SUPABASE_ACCESS_TOKEN + project ref: the Supabase Management API over HTTPS,
 *   for environments that cannot open raw TCP connections (e.g. cloud sandboxes).
 */
export interface SqlTarget {
  readonly label: string;
  /** Runs one or more statements; returns the rows of the last one. */
  query<T = Record<string, unknown>>(text: string): Promise<T[]>;
  /** Runs statements atomically. */
  transaction(text: string): Promise<void>;
  close(): Promise<void>;
}

export interface TargetEnv {
  [key: string]: string | undefined;
  DATABASE_URL?: string;
  SUPABASE_ACCESS_TOKEN?: string;
  SUPABASE_PROJECT_REF?: string;
  SUPABASE_URL?: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** TLS for remote hosts unless the URL says otherwise; plain TCP for localhost. */
export function sslModeFor(url: string): false | 'require' | 'verify-full' | 'prefer' {
  const parsed = new URL(url);
  const mode = parsed.searchParams.get('sslmode');
  if (mode === 'disable') return false;
  if (mode === 'verify-full' || mode === 'verify-ca') return 'verify-full';
  if (mode === 'prefer' || mode === 'allow') return 'prefer';
  if (mode === 'require') return 'require';
  return LOCAL_HOSTS.has(parsed.hostname) ? false : 'require';
}

export function redactUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.password) parsed.password = '****';
  return parsed.toString();
}

export function postgresTarget(url: string): SqlTarget {
  const sql = postgres(url, {
    max: 1,
    ssl: sslModeFor(url),
    prepare: false,
    onnotice: () => {},
    connect_timeout: 15,
  });
  return {
    label: redactUrl(url),
    async query<T>(text: string) {
      return (await sql.unsafe(text)) as unknown as T[];
    },
    async transaction(text: string) {
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
      });
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}

export function projectRefFrom(env: TargetEnv): string | undefined {
  if (env.SUPABASE_PROJECT_REF) return env.SUPABASE_PROJECT_REF;
  if (!env.SUPABASE_URL) return undefined;
  const host = new URL(env.SUPABASE_URL).hostname;
  return host.endsWith('.supabase.co') ? host.split('.')[0] : undefined;
}

export function managementApiTarget(token: string, projectRef: string, fetchImpl: typeof fetch = fetch): SqlTarget {
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  async function run<T>(text: string): Promise<T[]> {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: text }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Supabase Management API ${response.status}: ${body.slice(0, 500)}`);
    return (body ? JSON.parse(body) : []) as T[];
  }
  return {
    label: `supabase management api (project ${projectRef})`,
    query: run,
    async transaction(text: string) {
      await run(`begin;\n${text}\ncommit;`);
    },
    async close() {},
  };
}

export function resolveTarget(env: TargetEnv = process.env): SqlTarget {
  if (env.DATABASE_URL) return postgresTarget(env.DATABASE_URL);
  const ref = projectRefFrom(env);
  if (env.SUPABASE_ACCESS_TOKEN && ref) return managementApiTarget(env.SUPABASE_ACCESS_TOKEN, ref);
  throw new Error(
    'No database target. Set DATABASE_URL, or SUPABASE_ACCESS_TOKEN with SUPABASE_URL (or SUPABASE_PROJECT_REF).',
  );
}
