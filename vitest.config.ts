import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const web = (path: string) => fileURLToPath(new URL(`./apps/web/${path}`, import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          root: './packages/core',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'messaging',
          root: './packages/messaging',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'ui',
          root: './packages/ui',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: {
          alias: {
            'server-only': web('test/server-only-stub.ts'),
            '@/': web(''),
          },
        },
        test: {
          name: 'web',
          root: './apps/web',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'crm',
          root: './apps/crm',
          include: ['test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'db',
          root: './packages/db',
          include: ['test/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['test/global-setup.ts'],
          // Test files share one database; run them one after another.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
