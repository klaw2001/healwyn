import localFont from 'next/font/local';

// Self-hosted from npm (Fontsource): no request to a font CDN at build or run time.
export const fraunces = localFont({
  src: '../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2',
  variable: '--font-fraunces',
  weight: '100 900',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

export const atkinson = localFont({
  src: '../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2',
  variable: '--font-atkinson',
  weight: '200 800',
  display: 'swap',
  adjustFontFallback: 'Arial',
});
