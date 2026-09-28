import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import { site } from './src/config/site.ts';
import { defaultLocale, localeCodes } from './src/i18n/locales.ts';

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
  integrations: [svelte(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
