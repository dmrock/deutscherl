import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import type { AstroIntegration } from 'astro';
import { defineConfig, envField } from 'astro/config';
import { fontFamilies } from './src/config/fonts.ts';
import { site } from './src/config/site.ts';
import { defaultLocale, localeCodes } from './src/i18n/locales.ts';

const deployEnv = process.env.PUBLIC_DEPLOY_ENV ?? 'development';

/** Developer pages (font specimens): built in dev and for previews, never for production. */
function devPages(): AstroIntegration {
  return {
    name: 'dev-pages',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        if (deployEnv === 'production') return;
        injectRoute({ pattern: '/dev/fonts', entrypoint: './src/dev/fonts.astro' });
      },
    },
  };
}

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
  integrations: [svelte(), mdx(), devPages()],
  vite: {
    plugins: [tailwindcss()],
  },
});
