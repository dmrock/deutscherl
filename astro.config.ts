import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import { fontFamilies } from './src/config/fonts.ts';
import { site } from './src/config/site.ts';
import { defaultLocale, localeCodes, readyLocales } from './src/i18n/locales.ts';
import { inSitemap } from './src/lib/seo.ts';

export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  i18n: {
    locales: [...localeCodes],
    defaultLocale,
    routing: {
      prefixDefaultLocale: false,
    },
  },
  env: {
    schema: {
      // Set by CI: `preview` for pull request previews (adds noindex), `production` on main.
      PUBLIC_DEPLOY_ENV: envField.enum({
        context: 'client',
        access: 'public',
        values: ['development', 'preview', 'production'],
        default: 'development',
      }),
    },
  },
  fonts: fontFamilies(),
  integrations: [
    svelte(),
    mdx(),
    // Ready locales only; noindex pages are filtered out. Alternates come from the locale prefixes.
    sitemap({
      filter: inSitemap,
      i18n: {
        defaultLocale,
        locales: Object.fromEntries(readyLocales.map((code) => [code, code])),
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
