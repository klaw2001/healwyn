import 'server-only';

type Field = string | number | boolean | null | undefined;

/**
 * Structured, single-line logs. Only pass ids, codes and counts: never names,
 * phone numbers, emails or free text from an enquiry.
 */
function write(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, Field> = {}) {
  const line = JSON.stringify({ level, event, ...fields, at: new Date().toISOString() });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, fields?: Record<string, Field>) => write('info', event, fields),
  warn: (event: string, fields?: Record<string, Field>) => write('warn', event, fields),
  error: (event: string, fields?: Record<string, Field>) => write('error', event, fields),
};

/** Error name and code only: database errors can echo row values in their messages. */
export function errorFields(error: unknown): Record<string, Field> {
  const cause = error instanceof Error && error.cause ? error.cause : error;
  const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : undefined;
  return {
    error: error instanceof Error ? error.name : typeof error,
    code,
  };
}
