/**
 * Hero scene: a first call (left) travels along a path through three checks
 * (what you need, when, which language) to the matched doctor's team.
 * Decorative: the surrounding copy says the same thing in words.
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 470" className={className} aria-hidden="true" focusable="false">
      <path
        d="M70 96C112 30 214 14 300 30s178 62 196 150-18 196-102 236-214 44-290 4S4 300 18 214 28 162 70 96Z"
        fill="var(--hw-surface-teal)"
      />
      <circle cx="458" cy="70" r="9" fill="var(--hw-accent)" />
      <circle cx="40" cy="380" r="5" fill="var(--hw-accent)" />

      {/* the route */}
      <path
        d="M178 168C222 196 196 238 236 262s96-6 120 30 4 52 20 64"
        fill="none"
        stroke="var(--hw-primary)"
        strokeWidth="3"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />

      {/* first call card */}
      <g>
        <rect
          x="56"
          y="70"
          width="210"
          height="104"
          rx="22"
          fill="var(--hw-primary)"
          opacity="0.12"
          transform="translate(6 8)"
        />
        <rect x="56" y="70" width="210" height="104" rx="22" fill="var(--hw-surface)" stroke="var(--hw-line)" />
        <circle cx="96" cy="110" r="20" fill="var(--hw-primary)" />
        <path
          d="M89 101h4.5l2 5-2.5 1.8a12 12 0 0 0 6.4 6.4l1.8-2.5 5 2v4.5a2 2 0 0 1-2.1 2A19 19 0 0 1 87 103a2 2 0 0 1 2-2Z"
          fill="var(--hw-on-primary)"
        />
        <rect x="128" y="96" width="104" height="9" rx="4.5" fill="var(--hw-ink)" opacity="0.8" />
        <rect x="128" y="113" width="72" height="8" rx="4" fill="var(--hw-ink-muted)" opacity="0.45" />
        <g fill="var(--hw-accent)">
          <rect x="80" y="144" width="5" height="12" rx="2.5" />
          <rect x="90" y="139" width="5" height="22" rx="2.5" />
          <rect x="100" y="134" width="5" height="32" rx="2.5" />
          <rect x="110" y="141" width="5" height="18" rx="2.5" />
          <rect x="120" y="146" width="5" height="8" rx="2.5" />
          <rect x="130" y="142" width="5" height="16" rx="2.5" />
          <rect x="140" y="137" width="5" height="26" rx="2.5" />
          <rect x="150" y="144" width="5" height="12" rx="2.5" />
        </g>
      </g>

      {/* checkpoints */}
      <g>
        <circle cx="236" cy="262" r="21" fill="var(--hw-surface)" stroke="var(--hw-primary)" strokeWidth="2.5" />
        <path d="M227 258h18M227 265h12" stroke="var(--hw-primary)" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g>
        <circle cx="330" cy="268" r="21" fill="var(--hw-surface)" stroke="var(--hw-primary)" strokeWidth="2.5" />
        <circle cx="330" cy="268" r="9.5" fill="none" stroke="var(--hw-primary)" strokeWidth="2.5" />
        <path d="M330 262.5v6l4 2.5" fill="none" stroke="var(--hw-primary)" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g>
        <circle cx="168" cy="330" r="21" fill="var(--hw-surface)" stroke="var(--hw-primary)" strokeWidth="2.5" />
        <path
          d="M158 324h14m-7-4v4m-5 0c1 5 5 9 10 11m-2-11c-1 5-5 9-10 11"
          fill="none"
          stroke="var(--hw-primary)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M174 340l4-9 4 9m-6.5-3h5"
          fill="none"
          stroke="var(--hw-primary)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M189 326c18-8 30-26 40-44"
        fill="none"
        stroke="var(--hw-primary)"
        strokeWidth="3"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />

      {/* matched team card */}
      <g>
        <rect
          x="262"
          y="330"
          width="214"
          height="104"
          rx="22"
          fill="var(--hw-primary)"
          opacity="0.12"
          transform="translate(6 8)"
        />
        <rect x="262" y="330" width="214" height="104" rx="22" fill="var(--hw-surface)" stroke="var(--hw-line)" />
        <g>
          <circle cx="306" cy="372" r="19" fill="var(--hw-accent-soft)" stroke="var(--hw-surface)" strokeWidth="3" />
          <circle cx="306" cy="367" r="7" fill="#8d5a3b" />
          <path d="M293 386c2-7 7-10 13-10s11 3 13 10" fill="var(--hw-primary)" />
          <circle cx="334" cy="372" r="19" fill="var(--hw-primary-soft)" stroke="var(--hw-surface)" strokeWidth="3" />
          <circle cx="334" cy="367" r="7" fill="#c68a5e" />
          <path d="M327 362a8 8 0 0 1 14 0v-2a7 7 0 0 0-14 0Z" fill="#2c211c" />
          <path d="M321 386c2-7 7-10 13-10s11 3 13 10" fill="var(--hw-surface)" stroke="var(--hw-line-strong)" />
          <circle cx="362" cy="372" r="19" fill="var(--hw-surface-muted)" stroke="var(--hw-surface)" strokeWidth="3" />
          <circle cx="362" cy="367" r="7" fill="#a86d47" />
          <path d="M354 368c-2-9 4-12 8-12s10 3 8 12c0-4-3-7-8-7s-8 3-8 7Z" fill="#1f1714" />
          <path d="M349 386c2-7 7-10 13-10s11 3 13 10" fill="var(--hw-primary)" />
        </g>
        <rect x="290" y="404" width="118" height="9" rx="4.5" fill="var(--hw-ink)" opacity="0.8" />
        <rect x="290" y="419" width="76" height="7" rx="3.5" fill="var(--hw-ink-muted)" opacity="0.45" />
        <circle cx="440" cy="364" r="17" fill="var(--hw-accent)" />
        <path
          d="m432 364 5.5 5.5L448 359"
          fill="none"
          stroke="var(--hw-on-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* sprig */}
      <g fill="none" stroke="var(--hw-primary)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M452 238c-14 18-18 40-14 62" />
        <path d="M447 252c-10-2-17 2-20 10 9 2 16-1 20-10Z" fill="var(--hw-primary-soft)" />
        <path d="M441 275c10-4 18-1 22 7-9 3-17 0-22-7Z" fill="var(--hw-primary-soft)" />
      </g>
    </svg>
  );
}

/** A hand-drawn marigold underline for one phrase of a heading. */
export function Swash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 18" preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
      <path
        d="M4 13c40-6 90-9 146-8s104 3 146 1"
        fill="none"
        stroke="var(--hw-accent)"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
