/** A stylised, fictional neighbourhood map. Not a real location. */
export function LocationMap({ variant, className }: { variant: 'lake' | 'river'; className?: string }) {
  return (
    <svg
      viewBox="0 0 360 200"
      className={className}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="360" height="200" fill="var(--hw-surface-muted)" />
      {variant === 'lake' ? (
        <path d="M228 26c40-10 92 6 104 38s-20 58-62 56-72-18-74-48 4-38 32-46Z" fill="var(--hw-primary-soft)" />
      ) : (
        <path
          d="M-10 150c60-20 90 10 150-6s90-62 150-60 70 18 80 20v40c-40-10-60-30-100-20s-80 66-150 72S20 190-10 196Z"
          fill="var(--hw-primary-soft)"
        />
      )}
      <rect x="36" y="28" width="70" height="46" rx="10" fill="var(--hw-success-soft)" />
      <g stroke="var(--hw-surface)" strokeLinecap="round" fill="none">
        <path d="M0 100h360" strokeWidth="14" />
        <path d="M150 0v200" strokeWidth="12" />
        <path d="M0 40c80 0 120 30 150 60" strokeWidth="8" />
        <path d="M150 100c40 30 100 40 210 36" strokeWidth="8" />
      </g>
      <g fill="var(--hw-line)">
        <rect x="176" y="118" width="34" height="26" rx="5" />
        <rect x="88" y="118" width="40" height="30" rx="5" />
        <rect x="174" y="20" width="28" height="56" rx="5" />
      </g>
      <g transform="translate(150 100)">
        <ellipse cx="0" cy="6" rx="12" ry="4" fill="var(--hw-ink)" opacity="0.15" />
        <path d="M0 4c-12-14-18-22-18-31a18 18 0 0 1 36 0c0 9-6 17-18 31Z" fill="var(--hw-primary)" />
        <circle cx="0" cy="-27" r="7" fill="var(--hw-accent)" />
      </g>
    </svg>
  );
}
