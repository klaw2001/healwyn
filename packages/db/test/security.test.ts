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

  it('grants anon nothing, and authenticated (staff) only SELECT, on any table or view', async () => {
    const rows = await sql<{ table_name: string; grantee: string; privilege_type: string }[]>`
      select table_name, grantee, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')`;
    expect(rows.filter((r) => r.grantee === 'anon')).toEqual([]);
    expect(rows.filter((r) => r.privilege_type !== 'SELECT')).toEqual([]);
    expect(rows.map((r) => r.table_name)).not.toContain('rate_limits');
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

  it('lets the website role run only submit_lead, hit_rate_limit, opt_out_lead and start_web_call', async () => {
    const rows = await sql<{ fn: string }[]>`
      select p.oid::regprocedure::text as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('web_submitter', p.oid, 'execute')
      order by 1`;
    expect(rows.map((r) => r.fn)).toEqual([
      'hit_rate_limit(text,integer,integer)',
      'opt_out_lead(uuid,text)',
      'start_web_call(uuid,text,jsonb)',
      'submit_lead(jsonb)',
    ]);
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

  it('lets anon execute nothing, staff only the CRM functions, and the service role everything', async () => {
    const STAFF_FUNCTIONS = [
      'add_note(uuid,text,text)',
      'add_verified_number(text,text)',
      'assign_lead(uuid,uuid,text,jsonb)',
      'change_lead_stage(uuid,text,jsonb,text)',
      'complete_task(uuid)',
      'create_task(uuid,text,timestamp with time zone,uuid,timestamp with time zone)',
      'current_staff_id()',
      'current_staff_role()',
      'enroll_lead(uuid,jsonb)',
      'mark_replied(uuid)',
      'place_assistant_call(uuid,text,jsonb)',
      'record_consent_withdrawal(uuid,text,boolean)',
      'remove_verified_number(text)',
      'routing_context(uuid,text[])',
      'save_lead_score(uuid,integer,text,jsonb)',
      'set_sequence_paused(text,text,boolean)',
      'staff_can_see_lead(uuid,boolean,text)',
      'stop_enrollment(uuid)',
    ];
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
      expect({ fn: row.fn, anon: row.anon }).toEqual({ fn: row.fn, anon: false });
      const name = row.fn.replace(/^public\./, '');
      expect({ fn: row.fn, authed: row.authed }).toEqual({ fn: row.fn, authed: STAFF_FUNCTIONS.includes(name) });
      if (!row.is_trigger) expect({ fn: row.fn, service: row.service }).toEqual({ fn: row.fn, service: true });
    }
    // Internal helpers are not reachable through the API at all.
    const [internal] = await sql<{ n: number }[]>`
      select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app_private'
        and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))`;
    expect(internal?.n).toBe(0);
  });

  it('denies anon reading or writing leads directly', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe('set local role anon');
        await tx`select count(*) from public.leads`;
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it.each(['anon', 'authenticated'])('denies %s writing leads directly', async (role) => {
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

  it('shows signed-in users who are not active staff nothing', async () => {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: '00000000-0000-4000-8000-0000000000ff', role: 'authenticated' })}, true)`;
      return tx<{ count: number }[]>`select count(*)::int as count from public.leads`;
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
