import { BRAND } from '@healwyn/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Demo disclaimer',
  description: `${BRAND.demoNotice}.`,
};

export default function DisclaimerPage() {
  return (
    <LegalPage title="Demo disclaimer" intro={BRAND.demoDisclaimer}>
      <h2>What this site is</h2>
      <p>
        A working demonstration of a patient enquiry platform: brand, website, intake forms and the data model behind
        them. It shows how enquiries can be collected with clear consent and routed to the right team. It is built and
        shown as a portfolio piece.
      </p>

      <h2>What is fictional</h2>
      <ul>
        <li>The {BRAND.name} brand, its clinics, addresses and opening hours.</li>
        <li>Every doctor and staff profile. Portraits are illustrations, not photos of real people.</li>
        <li>Health packages, which have no prices and cannot be bought.</li>
        <li>Partner organisations named on the site.</li>
        <li>Email addresses ending in .example, which cannot receive mail.</li>
      </ul>

      <h2>What you should not do</h2>
      <ul>
        <li>Do not rely on anything here for health decisions.</li>
        <li>Do not enter real personal or health information into the forms.</li>
        <li>Do not visit the addresses shown.</li>
      </ul>

      <h2>Emergencies</h2>
      <p>{BRAND.emergencyNotice}</p>

      <p>
        Questions about the demo? See the <Link href="/privacy">privacy notice</Link> and{' '}
        <Link href="/terms">terms of use</Link>.
      </p>
    </LegalPage>
  );
}
