import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { connect, databaseUrl, samplePayload } from './helpers';

describe.skipIf(!databaseUrl)('database security', () => {
  const sql = databaseUrl ? connect() : (null as never);
  afterAll(() => sql?.end());

  it('has row level security on every table in public', async () => {
    const rows = await sql<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it('grants anon and authenticated nothing on any table or view', async () => {
    const rows = await sql`
      select table_name, grantee, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')`;
    expect(rows).toEqual([]);
  });

  it('gives no API role TRUNCATE, TRIGGER or REFERENCES on any table', async () => {
    const rows = await sql`
      select c.relname, r.rolname, p.privilege
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join (values ('anon'), ('authenticated'), ('service_role'), ('web_submitter')) as r(rolname)
      cross join (values ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) as p(privilege)
      where n.nspname = 'public' and c.relkind = 'r'
        and has_table_privilege(r.rolname, c.oid, p.privilege)`;
    expect(rows).toEqual([]);
  });

  it('blocks TRUNCATE of the audit tables, even for the owner', async () => {
    for (const table of ['lead_events', 'consent_records']) {
      await expect(sql.begin((tx) => tx.unsafe(`truncate public.${table} cascade`))).rejects.toThrow(
        /cannot be truncated/,
      );
    }
  });

  it('lets the website role run only submit_lead and hit_rate_limit', async () => {
    const rows = await sql<{ fn: string }[]>`
      select p.oid::regprocedure::text as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('web_submitter', p.oid, 'execute')
      order by 1`;
    expect(rows.map((r) => r.fn)).toEqual(['hit_rate_limit(text,integer,integer)', 'submit_lead(jsonb)']);
  });

  it('a login role in web_submitter can submit but cannot read or change anything', async () => {
    const role = `test_web_${process.pid}`;
    await sql.unsafe(`create role ${role} login`);
    await sql.unsafe(`grant web_submitter to ${role}`);
    const url = new URL(databaseUrl!);
    url.username = role;
    const web = postgres(url.toString(), { max: 1, onnotice: () => {} });
    try {
      const payload = await samplePayload();
      const [row] = await web`select public.submit_lead(${web.json(payload as never)}) as id`;
      expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
      const [limit] = await web`select public.hit_rate_limit('web-role-test', 5, 60) as allowed`;
      expect(limit?.allowed).toBe(true);
      await expect(web`select count(*) from public.leads`).rejects.toThrow(/permission denied/);
      await expect(web`update public.leads set stage = 'lost'`).rejects.toThrow(/permission denied/);
      await expect(web`select public.erase_lead(${row?.id}, 'test')`).rejects.toThrow(/permission denied/);
      await expect(web`select * from public.rate_limits`).rejects.toThrow(/permission denied/);
    } finally {
      await web.end();
      await sql.unsafe(`drop owned by ${role}; drop role ${role}`);
    }
  });

  it('lets only the service role execute public functions', async () => {
    const rows = await sql<{ fn: string; anon: boolean; authed: boolean; service: boolean; is_trigger: boolean }[]>`
      select p.oid::regprocedure::text as fn,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authed,
             has_function_privilege('service_role', p.oid, 'execute') as service,
             p.prorettype = 'trigger'::regtype as is_trigger
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'`;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect({ fn: row.fn, anon: row.anon, authed: row.authed }).toEqual({ fn: row.fn, anon: false, authed: false });
      if (!row.is_trigger) expect({ fn: row.fn, service: row.service }).toEqual({ fn: row.fn, service: true });
    }
  });

  it.each(['anon', 'authenticated'])('denies %s reading or writing leads directly', async (role) => {
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`select count(*) from public.leads`;
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`insert into public.leads (source, full_name, phone) values ('web_form', 'X Y', '+917000000099')`;
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it.each(['anon', 'authenticated'])('denies %s calling submit_lead', async (role) => {
    const payload = await samplePayload();
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`select public.submit_lead(${tx.json(payload as never)})`;
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it('even with table grants, RLS blocks authenticated (no policies yet)', async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`grant select on public.leads to authenticated`;
      await tx.unsafe('set local role authenticated');
      const result = await tx<{ count: number }[]>`select count(*)::int as count from public.leads`;
      await tx.unsafe('reset role');
      await tx`revoke select on public.leads from authenticated`;
      return result;
    });
    expect(rows[0]?.count).toBe(0);
  });

  it('allows the service role to submit leads', async () => {
    const payload = await samplePayload();
    const [row] = await sql.begin(async (tx) => {
      await tx.unsafe('set local role service_role');
      return tx<{ id: string }[]>`select public.submit_lead(${tx.json(payload as never)}) as id`;
    });
    expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
