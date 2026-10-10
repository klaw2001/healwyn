import { describe, expect, it, vi } from 'vitest';
import { createMemoryLeadStore, createSupabaseLeadStore, resolveLeadStoreKind } from '../src';
import { managementApiTarget, projectRefFrom, redactUrl, sslModeFor } from '../src/sql-target';
import { samplePayload } from './helpers';

describe('resolveLeadStoreKind', () => {
  const supabase = { SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'key' };
  const pg = { DATABASE_URL: 'postgresql://localhost/db' };

  it.each([
    [{}, 'memory'],
    [{ NODE_ENV: 'production' }, 'unconfigured'],
    [pg, 'postgres'],
    [{ ...pg, ...supabase }, 'supabase'],
    [{ ...pg, ...supabase, LEAD_STORE: 'postgres' }, 'postgres'],
    [{ LEAD_STORE: 'supabase', NODE_ENV: 'production' }, 'unconfigured'],
    [{ LEAD_STORE: 'memory', NODE_ENV: 'production', ...pg }, 'memory'],
    [{ SUPABASE_URL: 'https://abc.supabase.co', NODE_ENV: 'production' }, 'unconfigured'],
  ] as const)('%o -> %s', (env, kind) => {
    expect(resolveLeadStoreKind(env)).toBe(kind);
  });

  it('rejects unknown values', () => {
    expect(() => resolveLeadStoreKind({ LEAD_STORE: 'mongo' })).toThrow(/Unknown LEAD_STORE/);
  });
});

describe('memory store', () => {
  it('stores leads and rate-limits', async () => {
    const store = createMemoryLeadStore();
    const { id } = await store.submitLead(await samplePayload());
    expect(store.leads.get(id)?.fullName).toBe('Test Person');
    expect([await store.hitRateLimit('k', 1, 60), await store.hitRateLimit('k', 1, 60)]).toEqual([true, false]);
  });
});

describe('supabase store', () => {
  it('calls the submit_lead RPC with the service-role key', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify('3f2a91bc-0000-4000-8000-000000000000'), { status: 200 }),
    );
    const store = createSupabaseLeadStore('https://abc.supabase.co', 'service-key', {
      fetch: fetchMock as typeof fetch,
    });
    const payload = await samplePayload();
    await expect(store.submitLead(payload)).resolves.toEqual({ id: '3f2a91bc-0000-4000-8000-000000000000' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL, RequestInit];
    expect(String(url)).toBe('https://abc.supabase.co/rest/v1/rpc/submit_lead');
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('apikey')).toBe('service-key');
    expect(headers.get('authorization')).toBe('Bearer service-key');
    expect(JSON.parse(String(init.body))).toEqual({ payload });
  });

  it('wraps RPC errors without leaking the payload', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ code: '42501', message: 'permission denied' }), { status: 401 }),
    );
    const store = createSupabaseLeadStore('https://abc.supabase.co', 'bad', { fetch: fetchMock as typeof fetch });
    const error = await store.submitLead(await samplePayload()).then(
      () => new Error('expected a failure'),
      (e: unknown) => e as Error,
    );
    expect(error.message).toBe('Could not store the lead (42501)');
    expect(error.message).not.toContain('Test Person');
  });
});

describe('sql target helpers', () => {
  it('chooses TLS by host and sslmode', () => {
    expect(sslModeFor('postgresql://postgres@127.0.0.1:5432/db')).toBe(false);
    expect(sslModeFor('postgresql://postgres:x@db.abc.supabase.co:5432/postgres')).toBe('require');
    expect(sslModeFor('postgresql://u:x@host/db?sslmode=disable')).toBe(false);
    expect(sslModeFor('postgresql://u:x@host/db?sslmode=verify-full')).toBe('verify-full');
  });

  it('redacts passwords', () => {
    expect(redactUrl('postgresql://postgres:s3cret@db.example.com:5432/postgres')).not.toContain('s3cret');
  });

  it('derives the project ref', () => {
    expect(projectRefFrom({ SUPABASE_URL: 'https://yyabc.supabase.co' })).toBe('yyabc');
    expect(projectRefFrom({ SUPABASE_PROJECT_REF: 'explicit', SUPABASE_URL: 'https://x.supabase.co' })).toBe(
      'explicit',
    );
    expect(projectRefFrom({ SUPABASE_URL: 'https://example.com' })).toBeUndefined();
  });

  it('posts SQL to the Management API and wraps transactions', async () => {
    const fetchMock = vi.fn(async () => new Response('[{"ok":true}]', { status: 201 }));
    const target = managementApiTarget('sbp_token', 'abc', fetchMock as typeof fetch);
    await expect(target.query('select true as ok')).resolves.toEqual([{ ok: true }]);
    await target.transaction('select 1;');
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.supabase.com/v1/projects/abc/database/query');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer sbp_token');
    expect(JSON.parse(String(init.body)).query).toBe('begin;\nselect 1;\ncommit;');
  });
});
