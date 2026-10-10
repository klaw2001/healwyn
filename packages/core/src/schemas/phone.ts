/**
 * Indian mobile numbers: 10 digits starting 6 to 9, optionally prefixed with
 * +91, 91 or 0, with spaces, dashes, dots or brackets anywhere.
 * Landlines are not accepted: the number is used for call-backs.
 */
const MOBILE_PATTERN = /^(?:\+?91|0)?([6-9]\d{9})$/;

export function normalizeIndianMobile(input: string): string | null {
  const compact = input.trim().replace(/[\s\-().]/g, '');
  const match = MOBILE_PATTERN.exec(compact);
  return match ? `+91${match[1]}` : null;
}

export function isIndianMobile(input: string): boolean {
  return normalizeIndianMobile(input) !== null;
}

/** "+919876543210" -> "+91 98765 43210" */
export function formatIndianMobile(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `+91 ${match[1]} ${match[2]}` : e164;
}

/** "+919876543210" -> "+91 ••••• •3210", for logs and notifications. */
export function maskPhone(e164: string): string {
  const lastFour = e164.slice(-4);
  return `+91 ••••• •${lastFour}`;
}
