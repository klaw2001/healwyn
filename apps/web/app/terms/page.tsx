import { BRAND } from '@healwyn/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The rules for using this demo website.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" intro="Short and plain. By using this site you agree to these terms.">
      <h2>This is a demonstration</h2>
      <p>
        {BRAND.name} is fictional. No clinic, doctor, package or service on this site exists, and nothing here can be
        booked or bought. Read the <Link href="/disclaimer">demo disclaimer</Link> for details.
      </p>

      <h2>No medical advice</h2>
      <p>{BRAND.noAdviceNotice} Nothing on this site creates a doctor-patient relationship.</p>

      <h2>Emergencies</h2>
      <p>{BRAND.emergencyNotice}</p>

      <h2>Using the forms</h2>
      <ul>
        <li>Please enter only synthetic, made-up details. Do not enter real health information.</li>
        <li>Do not submit anything unlawful, abusive or automated.</li>
        <li>We may limit how often a connection can submit, to prevent spam.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        How we handle anything you submit is explained in the <Link href="/privacy">privacy notice</Link>.
      </p>

      <h2>Liability</h2>
      <p>
        The site is provided as is, for demonstration only. To the extent the law allows, the operator is not liable for
        any loss arising from its use.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India.</p>
    </LegalPage>
  );
}
