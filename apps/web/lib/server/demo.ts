import 'server-only';

/** DEMO_MODE=true: the demo bar shows, and enquiries are marked demo data (a demo reset clears them). */
export const demoMode = () => process.env.DEMO_MODE === 'true';

/** Options for building lead payloads: in a demo, new leads are demo data like the seeded ones. */
export const leadOptions = () => ({ isDemo: demoMode() });
