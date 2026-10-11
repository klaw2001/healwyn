import { demoUsers, homePathFor, industryPacks, isIndustryId, type IndustryPack } from '@healwyn/core';
import { BrandMark, cx, Notice, packThemeCss } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { packOf } from '@/lib/server/pack';
import { readSession } from '@/lib/server/session';
import { signInAsDemo } from './actions';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

function roleHints(pack: IndustryPack): Record<string, string> {
  return {
    manager: 'Sees everything, manages sequences',
    care_coordinator: 'Triages, assigns and books',
    specialist_doctor: `Sees only their own ${pack.leadNoun}s`,
    billing_desk: 'Payments and paid leads',
  };
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const session = await readSession();
  if (session) redirect(homePathFor(session.role));
  const params = await searchParams;
  const demo = process.env.DEMO_LOGIN === 'true';
  // Which industry's brand and demo users to show: ?industry=, else INDUSTRY, else the clinic.
  const requested = typeof params.industry === 'string' ? params.industry : process.env.INDUSTRY;
  const pack = packOf(requested && isIndustryId(requested) ? requested : 'clinic');
  const { brand } = pack;
  const hints = roleHints(pack);

  return (
    <main
      id="main"
      data-industry={pack.id}
      className="grid min-h-dvh bg-bg text-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <style href={`theme-${pack.id}`} precedence="default">
        {packThemeCss(pack.id, pack.theme)}
      </style>
      <section className="relative hidden overflow-hidden bg-primary p-12 text-on-primary lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10" />
          <span className="font-display text-2xl font-semibold">{brand.name}</span>
        </div>
        <div className="max-w-md">
          <p className="font-display text-4xl leading-tight">{brand.tagline}</p>
          <p className="mt-4 text-lg opacity-90">
            The staff workspace: every enquiry, its consent, its history and its next step.
          </p>
        </div>
        <p className="text-sm opacity-80">{brand.demoNotice}. Synthetic data only.</p>
        <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute -right-20 -bottom-24 size-96 opacity-15">
          <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="100" cy="100" r="85" fill="none" stroke="currentColor" strokeWidth="3" />
        </svg>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="font-display text-xl font-semibold">{brand.name}</span>
          </div>
          <h1 className="text-3xl">Staff sign in</h1>
          <p className="mt-2 text-ink-muted">Sign in with your work account.</p>
          {params.demo === 'missing' ? (
            <Notice tone="emergency" className="mt-6">
              The demo users are not in the database yet. Run <code>pnpm db:seed</code>.
            </Notice>
          ) : null}
          <div className="mt-8">
            <LoginForm />
          </div>

          {demo ? (
            <div className="mt-10 border-t border-line pt-8">
              <h2 className="font-sans text-sm font-semibold tracking-[0.08em] text-ink-muted uppercase">
                Sign in as a demo user
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Demo mode only. Each role sees a different slice of the data.
              </p>
              <nav aria-label="Industry" className="mt-4 flex flex-wrap gap-2">
                {Object.values(industryPacks).map((option) => (
                  <Link
                    key={option.id}
                    href={`/login?industry=${option.id}`}
                    aria-current={option.id === pack.id ? 'true' : undefined}
                    className={cx(
                      'rounded-full border px-3 py-1.5 text-sm font-semibold',
                      option.id === pack.id
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-line-strong bg-surface hover:border-primary',
                    )}
                  >
                    {option.label}
                  </Link>
                ))}
              </nav>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {demoUsers(pack.demo.staff).map((user) => {
                  const person = pack.demo.staff.find((m) => m.id === user.staffId);
                  return (
                    <li key={user.role}>
                      <form action={signInAsDemo}>
                        <input type="hidden" name="role" value={user.role} />
                        <input type="hidden" name="industry" value={pack.id} />
                        <button
                          type="submit"
                          className="w-full rounded-md border border-line-strong bg-surface px-4 py-3 text-left transition-colors hover:border-primary hover:bg-surface-teal"
                        >
                          <span className="block font-semibold">{pack.roleLabels[user.role]}</span>
                          <span className="block text-sm text-ink-muted">{person?.fullName}</span>
                          <span className="block text-xs text-ink-muted">{hints[user.role]}</span>
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
