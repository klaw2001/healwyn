import type { MetadataRoute } from 'next';

// Demo brand: keep it out of search engines unless explicitly enabled.
export default function robots(): MetadataRoute.Robots {
  return process.env.ALLOW_INDEXING === 'true'
    ? { rules: { userAgent: '*', allow: '/' } }
    : { rules: { userAgent: '*', disallow: '/' } };
}
