/**
 * Provisions a fresh database for the integration tests:
 * 1. TEST_DATABASE_URL set: creates a temporary database on that server.
 * 2. Otherwise, Postgres server binaries found: starts a throwaway cluster.
 * 3. Otherwise: provides null and the database tests skip (unit tests still run).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';
import { applyMigrations, LOCAL_SHIM_PATH } from '../src/migrations';
import { buildSeedSql } from '../src/seed';
import { postgresTarget } from '../src/sql-target';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string | null;
  }
}

function findPgBin(): string | null {
  try {
    const pgCtl = execFileSync('which', ['pg_ctl'], { encoding: 'utf8' }).trim();
    if (pgCtl) return join(pgCtl, '..');
  } catch {
    // not on PATH
  }
  const base = '/usr/lib/postgresql';
  if (!existsSync(base)) return null;
  const versions = readdirSync(base)
    .filter((v) => existsSync(join(base, v, 'bin/pg_ctl')))
    .sort((a, b) => Number(b) - Number(a));
  return versions[0] ? join(base, versions[0], 'bin') : null;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port')),
      );
    });
  });
}

const isRoot = process.getuid?.() === 0;
const asPg = (bin: string, args: string[]) =>
  isRoot
    ? execFileSync('runuser', ['-u', 'postgres', '--', bin, ...args], { stdio: 'pipe' })
    : execFileSync(bin, args, { stdio: 'pipe' });

async function prepare(url: string) {
  const target = postgresTarget(url);
  try {
    await target.query(readFileSync(LOCAL_SHIM_PATH, 'utf8'));
    await applyMigrations(target);
    await target.transaction(await buildSeedSql());
  } finally {
    await target.close();
  }
}

export default async function setup(project: TestProject) {
  const dbName = `healwyn_test_${process.pid}_${Date.now()}`;

  if (process.env.TEST_DATABASE_URL) {
    const admin = postgres(process.env.TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database ${dbName}`);
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.pathname = `/${dbName}`;
    await prepare(url.toString());
    project.provide('databaseUrl', url.toString());
    return async () => {
      await admin.unsafe(`drop database if exists ${dbName} with (force)`);
      await admin.end();
    };
  }

  const bin = findPgBin();
  if (!bin) {
    console.warn(
      '[db tests] No Postgres found (set TEST_DATABASE_URL or install Postgres 15+): skipping database tests.',
    );
    project.provide('databaseUrl', null);
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), 'healwyn-pg-'));
  if (isRoot) execFileSync('chown', ['-R', 'postgres:postgres', dir]);
  const data = join(dir, 'data');
  const port = await freePort();
  asPg(join(bin, 'initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--locale=C.UTF-8']);
  asPg(join(bin, 'pg_ctl'), [
    '-D',
    data,
    '-l',
    join(dir, 'server.log'),
    '-w',
    '-o',
    `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off`,
    'start',
  ]);

  const stop = () => {
    try {
      asPg(join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', 'stop']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  try {
    const admin = postgres(`postgresql://postgres@127.0.0.1:${port}/postgres`, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database ${dbName}`);
    await admin.end();
    const url = `postgresql://postgres@127.0.0.1:${port}/${dbName}`;
    await prepare(url);
    project.provide('databaseUrl', url);
  } catch (error) {
    stop();
    throw error;
  }
  return stop;
}
