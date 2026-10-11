/**
 * An illustrated, featureless portrait, generated deterministically from a
 * seed. Clearly a drawing, never a photo of a real person.
 */
const SKIN = ['#f1c7a3', '#d9a27b', '#c68a5e', '#a86d47', '#8d5a3b'];
const HAIR = ['#1f1714', '#2c211c', '#3b2a21', '#4a3426', '#6b6763'];
const BACKDROPS = ['var(--hw-primary-soft)', 'var(--hw-accent-soft)', 'var(--hw-surface-teal)'];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function PersonAvatar({
  seed,
  whiteCoat = false,
  className,
}: {
  seed: string;
  /** Draws a white coat (the clinic pack). */
  whiteCoat?: boolean;
  className?: string;
}) {
  const h = hash(seed);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >>> 3) % HAIR.length];
  const backdrop = BACKDROPS[(h >>> 6) % BACKDROPS.length];
  const style = (h >>> 9) % 4;
  const glasses = (h >>> 12) % 3 === 0;
  const clipId = `avatar-${h.toString(36)}`;

  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="120" height="120" fill={backdrop} />
        {/* Figure drawn on a 120 grid, enlarged 20% and anchored to the bottom edge. */}
        <g transform="translate(60 124) scale(1.2) translate(-60 -124)">
          {style === 1 ? <path d="M36 52c0-20 10-30 24-30s24 10 24 30v42H36Z" fill={hair} /> : null}
          <path d="M18 124c2-24 18-38 42-38s40 14 42 38Z" fill={whiteCoat ? '#f6f3ec' : 'var(--hw-primary)'} />
          {whiteCoat ? (
            <>
              <path
                d="M48 88l12 16 12-16"
                fill="none"
                stroke="var(--hw-primary)"
                strokeWidth="5"
                strokeLinejoin="round"
              />
              <path
                d="M46 92c-2 10 0 18 6 22"
                fill="none"
                stroke="var(--hw-ink-muted)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="53" cy="115" r="3.5" fill="var(--hw-ink-muted)" />
            </>
          ) : null}
          <rect x="52" y="70" width="16" height="18" rx="7" fill={skin} />
          <circle cx="60" cy="54" r="20" fill={skin} />
          {style === 0 ? (
            <path d="M40 52c-1-14 8-22 20-22s21 8 20 22c-3-8-10-12-20-12s-17 4-20 12Z" fill={hair} />
          ) : null}
          {style === 1 ? (
            <path d="M40 54c0-15 9-24 20-24s20 9 20 24c-6-6-12-12-21-13-6 3-13 8-19 13Z" fill={hair} />
          ) : null}
          {style === 2 ? (
            <>
              <circle cx="60" cy="30" r="8" fill={hair} />
              <path d="M40 52c-1-14 8-21 20-21s21 7 20 21c-4-7-11-10-20-10s-16 3-20 10Z" fill={hair} />
            </>
          ) : null}
          {style === 3 ? (
            <path d="M41 46c2-10 9-15 19-15 11 0 18 6 19 16-8-2-14-6-19-10-5 5-11 8-19 9Z" fill={hair} />
          ) : null}
          {glasses ? (
            <g fill="none" stroke="var(--hw-ink)" strokeWidth="2">
              <circle cx="52" cy="55" r="5.5" />
              <circle cx="68" cy="55" r="5.5" />
              <path d="M57.5 55h5" />
            </g>
          ) : null}
        </g>
      </g>
    </svg>
  );
}
