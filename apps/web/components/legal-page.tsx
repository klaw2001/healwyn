import { BRAND } from '@healwyn/core';
import { Container, Notice } from '@healwyn/ui';
import type { ReactNode } from 'react';
import { PageHeader } from './page-header';

export const LEGAL_UPDATED = '10 October 2026';

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHeader eyebrow="About this site" title={title} intro={intro} />
      <Container className="py-12 sm:py-16">
        <div className="mx-auto max-w-prose">
          <Notice tone="demo" title={BRAND.demoNotice}>
            This page is written for a fictional clinic so the demo is complete. It is not legal advice.
          </Notice>
          <div className="prose-legal mt-4">{children}</div>
          <p className="mt-12 border-t border-line pt-4 text-sm text-ink-muted">Last updated {LEGAL_UPDATED}.</p>
        </div>
      </Container>
    </>
  );
}
