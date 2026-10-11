import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';
import { pagePack } from '@/lib/pack';

export async function generateMetadata(props: PageProps<'/[industry]/disclaimer'>): Promise<Metadata> {
  const { brand } = await pagePack(props);
  return { title: 'Demo disclaimer', description: `${brand.demoNotice}.` };
}

export default async function DisclaimerPage(props: PageProps<'/[industry]/disclaimer'>) {
  const pack = await pagePack(props);
  const { brand } = pack;
  const { legal } = pack.site;
  return (
    <LegalPage pack={pack} title="Demo disclaimer" intro={brand.demoDisclaimer}>
      <h2>What this site is</h2>
      <p>
        A working demonstration of {legal.platform}: brand, website, intake forms, an AI intake assistant, a CRM,
        booking and test payments. It shows how enquiries can be collected with clear consent and routed to the right
        team. The same platform runs four fictional industries. It is built and shown as a portfolio piece.
      </p>

      <h2>What is fictional</h2>
      <ul>
        {legal.fictionalList.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>What you should not do</h2>
      <ul>
        <li>{legal.dontRely}</li>
        <li>Do not enter real personal information or {legal.sensitiveData} into the forms.</li>
        <li>Do not visit the addresses shown.</li>
      </ul>

      <h2>Emergencies</h2>
      <p>{brand.emergencyNotice}</p>

      <p>
        Questions about the demo? See the <Link href="/privacy">privacy notice</Link> and{' '}
        <Link href="/terms">terms of use</Link>.
      </p>
    </LegalPage>
  );
}
