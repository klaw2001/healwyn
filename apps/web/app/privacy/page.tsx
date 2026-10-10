import { BRAND, getActivePack } from '@healwyn/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'What we collect, why, how long we keep it, and how to withdraw consent.',
};

export default function PrivacyPage() {
  const pack = getActivePack();
  return (
    <LegalPage
      title="Privacy notice"
      intro="Plain answers to what we collect, why we collect it, and how you stay in control. Written with India's Digital Personal Data Protection Act, 2023 in mind."
    >
      <h2>Who we are</h2>
      <p>
        {BRAND.name} is a fictional clinic brand used to demonstrate a patient enquiry platform. For this notice,
        &quot;we&quot; means the operator of this demo. Contact for privacy questions: {BRAND.privacyEmail} (a
        placeholder address in this demo).
      </p>

      <h2>What we collect</h2>
      <p>Only what we need to respond to you:</p>
      <ul>
        <li>your name, mobile number and, if you give it, your email address;</li>
        <li>the language you would like us to use;</li>
        <li>the answers you choose on the form, such as the kind of help you need and when to contact you;</li>
        <li>an optional short note. Please do not include test results, diagnoses, medicines or ID numbers;</li>
        <li>a record of the consents you gave or withdrew, which wording you saw, and when.</li>
      </ul>
      <p>
        We do not use analytics, advertising cookies or third-party trackers. To stop spam we keep a short-lived,
        one-way scrambled (hashed) version of your connection&apos;s IP address, never the address itself, and delete it
        within a day.
      </p>

      <h2>Why we use it, and on what basis</h2>
      <p>We rely on your consent, which you give with two separate checkboxes on the form:</p>
      <ul>
        {pack.intake.consents.map((consent) => (
          <li key={consent.id}>
            <strong>{consent.title}</strong> ({consent.required ? 'needed to respond to you' : 'optional'}).
            {consent.id === 'assistant_call'
              ? ' Our AI assistant may call you between 9am and 9pm India time to understand your needs before a person picks up your enquiry. It always says it is an AI assistant, and it never gives medical advice.'
              : ' We use your details to respond to your enquiry and to match you with the right doctor’s team.'}
          </li>
        ))}
      </ul>

      <h2>How to withdraw consent</h2>
      <p>
        Email {BRAND.privacyEmail} with your reference number, or tell any member of our team. Withdrawing is as easy as
        giving consent. What happens next:
      </p>
      <ul>
        <li>
          If you withdraw consent to <strong>store and use your details</strong>, we delete your name, contact details,
          answers and note straight away. We keep only a record that consent was given and withdrawn, with no personal
          details attached.
        </li>
        <li>
          If you withdraw consent to <strong>calls from the AI assistant</strong>, it stops calling you. Your enquiry
          continues with a person.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep enquiry details for up to 12 months after our last contact with you, then delete them, unless you become
        a patient and the law requires longer retention of medical records.
      </p>

      <h2>Who we share it with</h2>
      <p>We do not sell or rent your data. We share it only with providers that help us run this service:</p>
      <ul>
        <li>our website host, which processes form submissions;</li>
        <li>our database provider, which stores enquiries in access-controlled storage;</li>
        <li>
          our email provider, which sends notifications to our team. Notification emails leave out your name, full phone
          number and note.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>You can ask us to:</p>
      <ul>
        <li>tell you what personal data we hold about you and how we use it;</li>
        <li>correct or complete it;</li>
        <li>erase it;</li>
        <li>nominate someone to exercise these rights for you if you cannot.</li>
      </ul>
      <p>
        If you are unhappy with our response, write to our grievance officer at {BRAND.privacyEmail}. We reply within 30
        days. You can also complain to the Data Protection Board of India.
      </p>

      <h2>Children</h2>
      <p>Enquiries for anyone under 18 should be made by a parent or guardian, who gives consent on their behalf.</p>

      <h2>Not for emergencies</h2>
      <p>{BRAND.emergencyNotice}</p>

      <p>
        See also our <Link href="/terms">terms of use</Link> and the <Link href="/disclaimer">demo disclaimer</Link>.
      </p>
    </LegalPage>
  );
}
