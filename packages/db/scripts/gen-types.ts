/**
 * Generates src/database.types.ts in the same shape as `supabase gen types`,
 * by introspecting a migrated Postgres database (local or remote).
 *
 *   DATABASE_URL="$(pnpm -s db:local url)" pnpm db:types
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { sslModeFor } from '../src/sql-target';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL to a migrated database (for example a local one: pnpm db:local start).');
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: sslModeFor(url), onnotice: () => {} });

interface ColumnRow {
  table_name: string;
  relkind: 'r' | 'v';
  column_name: string;
  typname: string;
  elem_typname: string | null;
  nullable: boolean;
  has_default: boolean;
  identity: string;
  generated: string;
}

interface FkRow {
  name: string;
  table_name: string;
  columns: string[];
  referenced_relation: string;
  referenced_columns: string[];
  one_to_one: boolean;
}

interface FnRow {
  name: string;
  arg_names: string[] | null;
  arg_types: string[];
  return_type: string;
  return_elem: string | null;
  returns_set: boolean;
}

const SCALARS: Record<string, string> = {
  bool: 'boolean',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  json: 'Json',
  jsonb: 'Json',
  text: 'string',
  varchar: 'string',
  bpchar: 'string',
  citext: 'string',
  uuid: 'string',
  date: 'string',
  time: 'string',
  timetz: 'string',
  timestamp: 'string',
  timestamptz: 'string',
  interval: 'string',
  inet: 'string',
  bytea: 'string',
  void: 'undefined',
};

function tsType(typname: string, elem: string | null): string {
  if (elem) return `${tsType(elem, null)}[]`;
  return SCALARS[typname] ?? 'unknown';
}

const key = (name: string) => (/^[a-z_][a-z0-9_]*$/i.test(name) ? name : JSON.stringify(name));

async function main() {
  const columns = await sql<ColumnRow[]>`
    select c.relname as table_name, c.relkind, a.attname as column_name, t.typname,
           case when t.typcategory = 'A' then et.typname end as elem_typname,
           not a.attnotnull as nullable, a.atthasdef as has_default,
           a.attidentity as identity, a.attgenerated as generated
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      join pg_type t on t.oid = a.atttypid
      left join pg_type et on et.oid = t.typelem
     where n.nspname = 'public' and c.relkind in ('r', 'v')
     order by c.relname, a.attnum`;

  const fks = await sql<FkRow[]>`
    select con.conname as name, cl.relname as table_name,
           array(select att.attname from unnest(con.conkey) with ordinality k(attnum, ord)
                 join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum order by k.ord)::text[] as columns,
           rcl.relname as referenced_relation,
           array(select att.attname from unnest(con.confkey) with ordinality k(attnum, ord)
                 join pg_attribute att on att.attrelid = con.confrelid and att.attnum = k.attnum order by k.ord)::text[] as referenced_columns,
           exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indisunique
                   and (i.indkey::int2[])::int2[] @> con.conkey and (i.indkey::int2[])::int2[] <@ con.conkey) as one_to_one
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join pg_class rcl on rcl.oid = con.confrelid
     where con.contype = 'f' and n.nspname = 'public'
     order by cl.relname, con.conname`;

  const fns = await sql<FnRow[]>`
    select p.proname as name, p.proargnames as arg_names,
           array(select t.typname from unnest(p.proargtypes::oid[]) with ordinality a(oid, ord)
                 join pg_type t on t.oid = a.oid order by a.ord)::text[] as arg_types,
           rt.typname as return_type,
           case when rt.typcategory = 'A' then ret.typname end as return_elem,
           p.proretset as returns_set
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_type rt on rt.oid = p.prorettype
      left join pg_type ret on ret.oid = rt.typelem
     where n.nspname = 'public' and p.prokind = 'f' and rt.typname <> 'trigger'
     order by p.proname`;

  const tables = new Map<string, ColumnRow[]>();
  const views = new Map<string, ColumnRow[]>();
  for (const column of columns) {
    const target = column.relkind === 'r' ? tables : views;
    target.set(column.table_name, [...(target.get(column.table_name) ?? []), column]);
  }

  const field = (column: ColumnRow, mode: 'row' | 'insert' | 'update', isView = false) => {
    const base = tsType(column.typname, column.elem_typname);
    const nullable = column.nullable || isView;
    const type = nullable ? `${base} | null` : base;
    if (mode === 'row') return `${key(column.column_name)}: ${type}`;
    if (column.identity === 'a' || column.generated === 's') return `${key(column.column_name)}?: never`;
    const optional = mode === 'update' || nullable || column.has_default || column.identity === 'd';
    return `${key(column.column_name)}${optional ? '?' : ''}: ${type}`;
  };

  const relationships = (table: string) =>
    fks
      .filter((fk) => fk.table_name === table)
      .map(
        (fk) => `{
          foreignKeyName: ${JSON.stringify(fk.name)}
          columns: ${JSON.stringify(fk.columns)}
          isOneToOne: ${fk.one_to_one}
          referencedRelation: ${JSON.stringify(fk.referenced_relation)}
          referencedColumns: ${JSON.stringify(fk.referenced_columns)}
        }`,
      )
      .join(',\n');

  const tableBlocks = [...tables].map(
    ([name, cols]) => `${key(name)}: {
      Row: { ${cols.map((c) => field(c, 'row')).join('; ')} }
      Insert: { ${cols.map((c) => field(c, 'insert')).join('; ')} }
      Update: { ${cols.map((c) => field(c, 'update')).join('; ')} }
      Relationships: [${relationships(name)}]
    }`,
  );

  const viewBlocks = [...views].map(
    ([name, cols]) => `${key(name)}: {
      Row: { ${cols.map((c) => field(c, 'row', true)).join('; ')} }
      Relationships: []
    }`,
  );

  const fnBlocks = fns.map((fn) => {
    const args = fn.arg_types.map(
      (type, index) => `${key(fn.arg_names?.[index] ?? `arg${index}`)}: ${tsType(type, null)}`,
    );
    const returns = tsType(fn.return_type, fn.return_elem);
    return `${key(fn.name)}: {
      Args: ${args.length ? `{ ${args.join('; ')} }` : 'never'}
      Returns: ${fn.returns_set ? `${returns}[]` : returns}
    }`;
  });

  const output = `// Generated by packages/db/scripts/gen-types.ts from the migrated schema.
// Do not edit by hand: run \`pnpm db:types\` after changing a migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: { ${tableBlocks.join('\n')} }
    Views: { ${viewBlocks.join('\n')} }
    Functions: { ${fnBlocks.join('\n')} }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
`;

  const target = join(import.meta.dirname, '../src/database.types.ts');
  writeFileSync(target, output);
  console.log(`Wrote ${target}: ${tables.size} tables, ${views.size} views, ${fns.length} functions.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
