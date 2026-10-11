import type { PackTheme, ThemeTokens } from '@healwyn/core';

const TOKEN_NAMES: Record<keyof ThemeTokens, string> = {
  primary: '--hw-primary',
  primaryHover: '--hw-primary-hover',
  primarySoft: '--hw-primary-soft',
  onPrimary: '--hw-on-primary',
  accent: '--hw-accent',
  accentSoft: '--hw-accent-soft',
  accentInk: '--hw-accent-ink',
  onAccent: '--hw-on-accent',
  surfaceTint: '--hw-surface-teal',
  focus: '--hw-focus',
};

const HEX = /^#[0-9a-f]{6}$/i;

function declarations(tokens: ThemeTokens): string {
  return (Object.keys(TOKEN_NAMES) as (keyof ThemeTokens)[])
    .map((key) => {
      if (!HEX.test(tokens[key])) throw new Error(`Theme token ${key} must be a #rrggbb colour`);
      return `${TOKEN_NAMES[key]}:${tokens[key]};`;
    })
    .join('');
}

/**
 * CSS that re-skins tokens.css for one industry pack, on `<html data-industry="<id>">`
 * or on any wrapper element with that attribute (a page shown before sign-in).
 * The selectors are more specific than the base theme's, so the pack's light and
 * dark colours win in every mode (system, forced light, forced dark).
 */
export function packThemeCss(id: string, theme: PackTheme): string {
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(id)) throw new Error('Invalid pack id');
  const root = `:root[data-industry='${id}']`;
  const inner = `[data-industry='${id}']`;
  const light = declarations(theme.light);
  const dark = declarations(theme.dark);
  return [
    `${root},:root ${inner}{${light}}`,
    `@media (prefers-color-scheme: dark){${root}:not([data-theme='light']),:root:not([data-theme='light']) ${inner}{${dark}}}`,
    `${root}[data-theme='dark'],:root[data-theme='dark'] ${inner}{${dark}}`,
  ].join('\n');
}
