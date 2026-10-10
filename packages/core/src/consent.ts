import { BRAND } from './brand';
import type { ConsentDefinition } from './industries/types';

export type ConsentSegment =
  { readonly type: 'text'; readonly value: string } | { readonly type: 'privacy-link'; readonly value: string };

export const PRIVACY_PATH = '/privacy';
const PRIVACY_LABEL = 'privacy notice';

function fillTokens(text: string): string {
  return text.replaceAll('{brand}', BRAND.name).replaceAll('{email}', BRAND.privacyEmail);
}

/** Splits consent text so the UI can render `{privacy}` as a link. */
export function consentSegments(def: ConsentDefinition): ConsentSegment[] {
  const parts = fillTokens(def.text).split('{privacy}');
  const segments: ConsentSegment[] = [];
  parts.forEach((part, index) => {
    if (index > 0) segments.push({ type: 'privacy-link', value: PRIVACY_LABEL });
    if (part) segments.push({ type: 'text', value: part });
  });
  return segments;
}

/** The exact wording a person agreed to, as plain text. Hashed into every consent record. */
export function consentPlainText(def: ConsentDefinition): string {
  return fillTokens(def.text).replaceAll('{privacy}', `${PRIVACY_LABEL} (${PRIVACY_PATH})`);
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function consentFieldName(consentId: string): string {
  return `consent_${consentId}`;
}
