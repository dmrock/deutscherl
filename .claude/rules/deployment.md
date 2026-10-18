---
paths:
  - ".github/**"
  - "wrangler.jsonc"
  - "scripts/ci/**"
  - "astro.config.ts"
  - "lefthook.yml"
---

# CI and deployment

## CI

- One GitHub Actions workflow. Checks run as parallel jobs: DCO, language check, content checks (`pnpm validate`, `pnpm i18n:coverage`, `pnpm review:check`), lint (`biome ci` + Prettier), `astro check`, Vitest, build (also runs `pnpm budget`), E2E on the build output.
- Required status checks (job names): `DCO`, `Language check`, `Content checks`, `Lint`, `Astro check`, `Unit tests`, `Build`, `E2E tests`. Deploy jobs need every check.
- GitHub Actions are pinned to commit SHAs with the version in a comment.

## Deployment (Cloudflare Workers static assets, Wrangler)

- Pull requests: `wrangler versions upload --preview-alias pr-<number>`, then a PR comment with the preview URL. Preview builds set `PUBLIC_DEPLOY_ENV=preview`, which adds `noindex` to every page.
- Push to `main`: `wrangler deploy` in the GitHub Environment `production`; `concurrency` prevents overlapping deploys.
- Deploy jobs run only for branches of this repository, never for forks.
- First deploy: if the Worker does not exist yet, the preview job deploys once without `routes` (`scripts/ci/wrangler-bootstrap-config.ts`), so the custom domain is attached only by the first production deploy.
- `wrangler.jsonc`: `assets.directory: "./dist"`, `assets.not_found_handling: "404-page"`, default HTML handling (trailing slash, matching Astro), production only on the custom domain (`workers_dev: false`), preview URLs enabled. Check the current Wrangler docs for exact keys.
- Preview URLs live on the account's workers.dev subdomain (`pr-<n>-deutscherl.<subdomain>.workers.dev`); opening Workers & Pages in the dashboard once creates it.
- Secrets: `CLOUDFLARE_API_TOKEN` (least privilege: edit Workers for this account) and the variable `CLOUDFLARE_ACCOUNT_ID`. Nothing else is secret.

## Analytics

Cloudflare Web Analytics with automatic setup: Cloudflare injects the beacon into HTML pages on the production domain (Web Analytics → the site → "Manage site" → "Enable"); preview URLs are not part of the zone. The build adds no beacon and holds no token, since a second beacon would count every visit twice (checked by an e2e test). No other analytics or tracking SDKs. Google Search Console is verified via a DNS record, no code.
