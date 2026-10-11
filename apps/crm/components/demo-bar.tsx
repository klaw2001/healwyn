import { demoTour, industryPacks, type IndustryPack } from '@healwyn/core';
import { DemoTour } from '@healwyn/ui';
import { cookies } from 'next/headers';
import { resetDemo, switchIndustry } from '@/app/demo-actions';
import { DEMO_FLASH_COOKIE } from '@/lib/demo';

const SHORT_LABELS: Record<string, string> = {
  clinic: 'Clinic',
  real_estate: 'Real estate',
  wealth_advisory: 'Wealth advisory',
  home_interiors: 'Home interiors',
};

const FLASH: Record<string, string> = {
  reset: 'Demo data restored.',
  busy: 'The demo was reset a moment ago. Try again in a few minutes.',
  unavailable: 'Reset needs DATABASE_URL on the server. Run pnpm demo:reset instead.',
  failed: 'The reset did not work. Run pnpm demo:reset instead.',
};

/** Shown only when DEMO_MODE=true: switch industry, reset the demo data, open the website, guided tour. */
export async function DemoBar({ pack, signedIn }: { pack: IndustryPack | null; signedIn: boolean }) {
  const web = process.env.SITE_URL || 'http://localhost:3000';
  const crm = process.env.CRM_URL || 'http://localhost:3001';
  const flash = (await cookies()).get(DEMO_FLASH_COOKIE)?.value;
  const tourPack = pack ?? industryPacks.clinic;
  return (
    <div role="region" aria-label="Demo controls" className="bg-ink text-bg">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm sm:px-8">
        <span className="font-bold">Demo mode</span>
        <form action={switchIndustry} className="flex flex-wrap items-center gap-1">
          <span id="demo-industry-label" className="sr-only">
            Switch industry
          </span>
          {Object.values(industryPacks).map((option) => (
            <button
              key={option.id}
              type="submit"
              name="industry"
              value={option.id}
              aria-describedby="demo-industry-label"
              aria-current={option.id === pack?.id ? 'true' : undefined}
              className="min-h-10 rounded-md px-2 underline-offset-4 hover:underline aria-[current=true]:bg-bg aria-[current=true]:font-semibold aria-[current=true]:text-ink"
            >
              {SHORT_LABELS[option.id] ?? option.brand.shortName}
            </button>
          ))}
        </form>
        {signedIn && pack ? (
          <form action={resetDemo}>
            <button type="submit" className="min-h-10 rounded-md border border-current px-3 font-semibold">
              Reset demo
            </button>
          </form>
        ) : null}
        <a
          href={`${web}/api/demo/industry?i=${tourPack.id}`}
          className="inline-flex min-h-10 items-center underline underline-offset-4"
        >
          Open the website
        </a>
        {flash && FLASH[flash] ? (
          <span role="status" className="font-semibold">
            {FLASH[flash]}
          </span>
        ) : null}
        <div className="ml-auto">
          <DemoTour steps={demoTour(tourPack)} app="crm" urls={{ web, crm }} />
        </div>
      </div>
    </div>
  );
}
