import { demoTour, industryPacks, type IndustryPack } from '@healwyn/core';
import { DemoTour } from '@healwyn/ui';

const SHORT_LABELS: Record<string, string> = {
  clinic: 'Clinic',
  real_estate: 'Real estate',
  wealth_advisory: 'Wealth advisory',
  home_interiors: 'Home interiors',
};

/**
 * Shown only when DEMO_MODE=true: switch industry (re-skins the whole site),
 * open the CRM, and the guided tour. Plain links, so it works without JavaScript.
 */
export function DemoBar({ pack }: { pack: IndustryPack }) {
  const crm = process.env.CRM_URL || 'http://localhost:3001';
  const web = process.env.SITE_URL || 'http://localhost:3000';
  return (
    <div role="region" aria-label="Demo controls" className="bg-ink text-bg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm sm:px-6">
        <span className="font-bold">Demo mode</span>
        <nav aria-label="Switch industry" className="flex flex-wrap items-center gap-1">
          {Object.values(industryPacks).map((option) => (
            <a
              key={option.id}
              href={`/api/demo/industry?i=${option.id}`}
              aria-current={option.id === pack.id ? 'true' : undefined}
              className="inline-flex min-h-10 items-center rounded-md px-2 underline-offset-4 hover:underline aria-[current=true]:bg-bg aria-[current=true]:font-semibold aria-[current=true]:text-ink"
            >
              {SHORT_LABELS[option.id] ?? option.brand.shortName}
            </a>
          ))}
        </nav>
        <a
          href={`${crm}/login?industry=${pack.id}`}
          className="inline-flex min-h-10 items-center underline underline-offset-4"
        >
          Open the CRM
        </a>
        <div className="ml-auto">
          <DemoTour steps={demoTour(pack)} app="web" urls={{ web, crm }} />
        </div>
      </div>
    </div>
  );
}
