/**
 * The system architecture diagram, as SVG markup. One source for two uses: the
 * case-study page (theme colours, so it re-skins per industry and follows dark
 * mode) and `docs/architecture.svg` (fixed colours; `pnpm architecture:svg`).
 * The Mermaid source in docs/ARCHITECTURE.md describes the same picture.
 */

export interface DiagramColors {
  background: string;
  surface: string;
  core: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
}

export const THEME_COLORS: DiagramColors = {
  background: 'transparent',
  surface: 'var(--hw-surface)',
  core: 'var(--hw-primary-soft)',
  line: 'var(--hw-line-strong)',
  ink: 'var(--hw-ink)',
  muted: 'var(--hw-ink-muted)',
  accent: 'var(--hw-primary)',
};

export const STATIC_COLORS: DiagramColors = {
  background: '#fbf8f3',
  surface: '#ffffff',
  core: '#d7ece8',
  line: '#8a9a97',
  ink: '#15302e',
  muted: '#4a5d5a',
  accent: '#0f6b63',
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  lines: string[];
  core?: boolean;
}

const BOXES: Box[] = [
  { x: 20, y: 80, w: 150, h: 60, title: 'Visitor', lines: ['phone or laptop'] },
  { x: 20, y: 200, w: 150, h: 70, title: 'Razorpay', lines: ['test mode', 'or simulated'] },
  { x: 20, y: 440, w: 150, h: 60, title: 'Staff', lines: ['CRM in the browser'] },
  {
    x: 220,
    y: 20,
    w: 250,
    h: 180,
    title: 'Website (Next.js)',
    lines: [
      'Pages per industry pack',
      'Enquiry forms (zod both sides)',
      'Booking and test payments',
      'Assistant widget: typed or voice',
    ],
  },
  {
    x: 220,
    y: 240,
    w: 250,
    h: 100,
    title: 'Industry packs',
    lines: ['Brand, copy, questions, stages,', 'sequences, routing, voice script,', 'safety rules, demo data'],
    core: true,
  },
  {
    x: 220,
    y: 380,
    w: 250,
    h: 180,
    title: 'CRM (Next.js)',
    lines: [
      'Pipeline, lead profile, AI summary',
      'Routing with reasons',
      'Bookings, payments, dashboard',
      'Signed webhooks in',
    ],
  },
  {
    x: 520,
    y: 20,
    w: 250,
    h: 130,
    title: 'Intake assistant (Python)',
    lines: ['Scripted lines only', 'Safety checks first, every turn', 'Text service + LiveKit agent'],
  },
  {
    x: 520,
    y: 220,
    w: 250,
    h: 180,
    title: 'Postgres (Supabase)',
    lines: [
      'Row level security per role',
      'and per industry',
      'Writes through SQL functions',
      'Append-only audit tables',
      'No double booking (constraint)',
    ],
    core: true,
  },
  {
    x: 520,
    y: 450,
    w: 250,
    h: 110,
    title: 'Nurture worker',
    lines: ['Due steps, once each', 'No-shows after 2 hours', 'Email real; SMS simulated'],
  },
  { x: 820, y: 20, w: 260, h: 55, title: 'LiveKit Cloud', lines: ['voice rooms'] },
  { x: 820, y: 95, w: 260, h: 55, title: 'Google Gemini', lines: ['maps answers to options'] },
  { x: 820, y: 450, w: 260, h: 55, title: 'Resend', lines: ['email'] },
];

interface Edge {
  from: [number, number];
  to: [number, number];
  /** Corner points between from and to, for an elbow line. */
  via?: [number, number][];
  label?: string;
  labelAt?: [number, number];
  dashed?: boolean;
  vertical?: boolean;
}

const EDGES: Edge[] = [
  { from: [170, 110], to: [218, 110] },
  { from: [170, 235], to: [218, 185], label: 'signed webhook', labelAt: [124, 190] },
  { from: [170, 470], to: [218, 470] },
  { from: [470, 70], to: [518, 70], label: 'signed', labelAt: [474, 62] },
  { from: [770, 47], to: [818, 47] },
  { from: [770, 122], to: [818, 122] },
  { from: [470, 180], to: [518, 245], label: 'web role', labelAt: [500, 200] },
  { from: [470, 430], to: [518, 380], label: 'RLS', labelAt: [500, 425] },
  {
    from: [520, 135],
    via: [
      [490, 135],
      [490, 360],
      [440, 360],
    ],
    to: [440, 378],
    label: 'call results (signed)',
    labelAt: [482, 300],
    vertical: true,
  },
  { from: [470, 520], to: [518, 520], label: 'cron', labelAt: [478, 512] },
  { from: [645, 450], to: [645, 402] },
  { from: [770, 477], to: [818, 477] },
  { from: [345, 240], to: [345, 202], dashed: true },
  { from: [345, 340], to: [345, 378], dashed: true },
];

const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function architectureSvg(colors: DiagramColors, options: { id?: string } = {}): string {
  const id = options.id ?? 'architecture';
  const marker = `${id}-arrow`;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 600" role="img" aria-labelledby="${id}-title ${id}-desc" font-family="Atkinson Hyperlegible, system-ui, sans-serif">`,
    `<title id="${id}-title">How the platform fits together</title>`,
    `<desc id="${id}-desc">Visitors use the website, which stores enquiries, bookings and test payments in Postgres through a least-privilege role and talks to the Python intake assistant with signed requests. The assistant uses LiveKit for voice and Gemini only to map answers to allowed options, and posts signed call results to the CRM. Staff use the CRM, which reads Postgres under row level security. A nurture worker sends due messages by email through Resend. Razorpay sends signed payment webhooks to the website. Industry packs configure the website, the CRM, the worker and the assistant.</desc>`,
    `<defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${colors.line}"/></marker></defs>`,
  );
  if (colors.background !== 'transparent') {
    parts.push(`<rect width="1100" height="600" fill="${colors.background}"/>`);
  }
  for (const box of BOXES) {
    parts.push(
      `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="10" fill="${box.core ? colors.core : colors.surface}" stroke="${box.core ? colors.accent : colors.line}" stroke-width="${box.core ? 2 : 1.5}"/>`,
      `<text x="${box.x + 14}" y="${box.y + 24}" font-size="15" font-weight="700" fill="${colors.ink}">${escape(box.title)}</text>`,
      ...box.lines.map(
        (line, i) =>
          `<text x="${box.x + 14}" y="${box.y + 46 + i * 19}" font-size="13" fill="${colors.muted}">${escape(line)}</text>`,
      ),
    );
  }
  for (const edge of EDGES) {
    const points = [edge.from, ...(edge.via ?? []), edge.to].map(([x, y]) => `${x},${y}`).join(' ');
    parts.push(
      `<polyline points="${points}" fill="none" stroke="${colors.line}" stroke-width="1.6"${edge.dashed ? ' stroke-dasharray="5 4"' : ` marker-end="url(#${marker})"`}/>`,
    );
    if (edge.label && edge.labelAt) {
      const [x, y] = edge.labelAt;
      const rotate = edge.vertical ? ` transform="rotate(-90 ${x} ${y})"` : '';
      parts.push(
        `<text x="${x}" y="${y}" font-size="11" fill="${colors.muted}"${rotate}${edge.vertical ? ' text-anchor="middle"' : ''}>${escape(edge.label)}</text>`,
      );
    }
  }
  parts.push('</svg>');
  return parts.join('\n');
}
