import 'server-only';

/**
 * Reads a request body up to `maxBytes`, stopping as soon as it is exceeded
 * (whatever Content-Length says, or when it is missing). Null when too large.
 */
export async function readBodyLimited(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
