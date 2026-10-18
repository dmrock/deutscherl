import type { APIRoute } from 'astro';
import { site } from '../config/site.ts';

// Everything may be crawled: pages that should not be indexed carry `noindex` instead (a crawler
// that is blocked by robots.txt never sees it).
export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', site.url).href}\n`,
  );
