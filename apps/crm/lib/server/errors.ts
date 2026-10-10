import 'server-only';

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Turns database and permission errors into messages staff can act on. Never echoes row data. */
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (message.includes('lead not found') || code === 'P0002') return 'That lead is not available to you.';
  if (code === '42501' || /may not do this|permission/i.test(message)) return 'You do not have permission to do that.';
  if (/session has ended/i.test(message)) return message;
  if (/has been erased/.test(message)) return 'This lead’s details have been erased.';
  if (/cannot receive messages/.test(message)) return 'This lead has unsubscribed or been erased.';
  return 'Something went wrong. Please try again.';
}
