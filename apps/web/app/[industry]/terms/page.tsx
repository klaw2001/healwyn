import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';
import { pagePack } from '@/lib/pack';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The rules for using this demo website.',
};

export default async function TermsPage(props: PageProps<'/[industry]/terms'>) {
  const pack = await pagePack(props);
  const { brand } = pack;
  const { legal } = pack.site;
  return (
    <LegalPage pack={pack} title="Terms of use" intro="Short and plain. By using this site you agree to these terms.">
      <h2>This is a demonstration</h2>
      <p>
        {brand.name} is fictional. No {legal.fictionalThings} on this site exists. Bookings and payments here are
        demonstrations: payments run in test mode and nothing is ever charged. Read the{' '}
        <Link href="/disclaimer">demo disclaimer</Link> for details.
      </p>

      <h2>{legal.noAdviceHeading}</h2>
      <p>
        {brand.noAdviceNotice} {legal.relationship}
      </p>

      <h2>Emergencies</h2>
      <p>{brand.emergencyNotice}</p>

      <h2>Using the forms</h2>
      <ul>
        <li>Please enter only synthetic, made-up details. Do not enter real {legal.sensitiveData}.</li>
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
