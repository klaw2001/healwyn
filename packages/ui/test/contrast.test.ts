import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { industryPacks, type ThemeTokens } from '@healwyn/core';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, '../src/tokens.css'), 'utf8');

function tokensIn(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--hw-([a-z-]+):\s*(#[0-9a-f]{6})/gi)) tokens[match[1]!] = match[2]!;
  return tokens;
}

const light = tokensIn(css.slice(css.indexOf(':root {'), css.indexOf('@media')));
const dark = tokensIn(css.slice(css.indexOf(":root[data-theme='dark']"), css.indexOf('@theme')));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** [foreground, background, minimum ratio] */
const PAIRS: [string, string, number][] = [
  ['ink', 'bg', 4.5],
  ['ink', 'surface', 4.5],
  ['ink', 'surface-muted', 4.5],
  ['ink', 'surface-teal', 4.5],
  ['ink', 'primary-soft', 4.5],
  ['ink', 'accent-soft', 4.5],
  ['ink', 'danger-soft', 4.5],
  ['ink-muted', 'bg', 4.5],
  ['ink-muted', 'surface', 4.5],
  ['ink-muted', 'surface-muted', 4.5],
  ['ink-muted', 'surface-teal', 4.5],
  ['primary', 'bg', 4.5],
  ['primary', 'surface', 4.5],
  ['primary', 'surface-teal', 4.5],
  ['on-primary', 'primary', 4.5],
  ['on-primary', 'primary-hover', 4.5],
  ['on-accent', 'accent', 4.5],
  ['accent-ink', 'bg', 4.5],
  ['accent-ink', 'surface', 4.5],
  ['accent-ink', 'accent-soft', 4.5],
  ['danger', 'bg', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['success', 'success-soft', 4.5],
  // Non-text UI: input borders and focus rings need 3:1 (WCAG 1.4.11).
  ['line-strong', 'surface', 3],
  ['line-strong', 'bg', 3],
  ['focus', 'bg', 3],
  ['focus', 'surface', 3],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, tokens) => {
  it('defines every token used in the checks', () => {
    for (const [fg, bg] of PAIRS) {
      expect(tokens[fg], fg).toBeDefined();
      expect(tokens[bg], bg).toBeDefined();
    }
  });

  it.each(PAIRS)('%s on %s is at least %s:1', (fg, bg, min) => {
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(min);
  });
});

describe('theme blocks', () => {
  it('keep the media-query and data-theme dark palettes identical', () => {
    const media = tokensIn(css.slice(css.indexOf('@media'), css.indexOf(":root[data-theme='dark']")));
    expect(media).toEqual(dark);
  });
});

/** A pack's theme overrides these tokens; every pairing above must still pass with them. */
function withPack(base: Record<string, string>, theme: ThemeTokens): Record<string, string> {
  return {
    ...base,
    primary: theme.primary,
    'primary-hover': theme.primaryHover,
    'primary-soft': theme.primarySoft,
    'on-primary': theme.onPrimary,
    accent: theme.accent,
    'accent-soft': theme.accentSoft,
    'accent-ink': theme.accentInk,
    'on-accent': theme.onAccent,
    'surface-teal': theme.surfaceTint,
    focus: theme.focus,
  };
}

describe.each(Object.values(industryPacks).map((pack) => [pack.id, pack.theme] as const))(
  '%s pack theme contrast',
  (_id, theme) => {
    it.each(PAIRS)('light: %s on %s is at least %s:1', (fg, bg, min) => {
      const tokens = withPack(light, theme.light);
      expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(min);
    });
    it.each(PAIRS)('dark: %s on %s is at least %s:1', (fg, bg, min) => {
      const tokens = withPack(dark, theme.dark);
      expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(min);
    });
  },
);
