---
paths:
  - ".github/**"
  - "wrangler.jsonc"
  - "scripts/ci/**"
  - "astro.config.ts"
  - "lefthook.yml"
  - ".claude/skills/**"
---

# CI and deployment

## CI

- Two GitHub Actions workflows: `ci.yml` for checks and deploys, `review.yml` for the review below. In `ci.yml`, checks run as parallel jobs: DCO, language check, content checks (`pnpm validate`, `pnpm i18n:coverage`, `pnpm review:check`), lint (`biome ci` + Prettier), `astro check`, Vitest, build (also runs `pnpm budget`), E2E on the build output.
- Required status checks (job names): `DCO`, `Language check`, `Content checks`, `Lint`, `Astro check`, `Unit tests`, `Build`, `E2E tests`. Deploy jobs need every check.
- GitHub Actions are pinned to commit SHAs with the version in a comment.

## Pull request review

- `review.yml` runs Claude Code (`anthropics/claude-code-action`) with the project skill `/pr-review` (`.claude/skills/pr-review/SKILL.md`). It checks bugs, `CLAUDE.md` and the `.claude/rules/` files that match the changed paths, German content, and the linked issue, then posts inline comments and one summary comment from `github-actions[bot]`. The review is advisory; its check is not required.
- It runs when a pull request opens, is reopened or leaves draft, and again when the `review` label is added (the workflow removes the label afterwards). Branches of this repository only, never forks or bots.
- Trigger `pull_request_target`, so the workflow, the skill and the rules come from `main`; a pull request cannot change how it is reviewed. The pull request's files are checked out into `pr-head/` without their `.claude/` and `CLAUDE.md` files and are only read: the job runs no script or package from the pull request.
- The skill starts parallel sub-agents (bugs, project rules, German content, spec) on every pull request, then a verifier sub-agent when they found anything. The workflow sets `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` so that sub-agents run in the foreground, because the action ends the session at the first result and would cut off background sub-agents.
- Claude's tools are read-only plus sub-agents and posting comments (`Read`, `Grep`, `Glob`, `Agent`, `gh pr view/diff/comment`, `gh issue view`, the inline-comment tool). The same list is in the workflow's `--allowedTools` and the skill's `allowed-tools`; keep them equal. Sub-agents get the same permissions. Any other tool call, including a Bash command with a pipe, redirect, loop or `cd`, is denied, so the skill tells every agent to read files with `Read`/`Grep`/`Glob` and to run each `gh` command alone. A step after the review logs the number of sub-agents and the denied tool names (for Bash, the first word of the command), never the transcript. `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` keeps the token out of the commands it runs. The scrub needs bubblewrap, which the action installs only when `allowed_non_write_users` is set, so a step before the review installs it (and `socat`) and allows unprivileged user namespaces.
- Authentication: the maintainer's Claude subscription token (`claude setup-token`) as the secret `CLAUDE_CODE_OAUTH_TOKEN` of the GitHub Environment `claude-review`, whose deployment branches are `main` only, so a workflow on any other branch cannot read it. When someone else gets write access, add a required reviewer to that environment.

## Deployment (Cloudflare Workers static assets, Wrangler)

- Pull requests: `wrangler versions upload --preview-alias pr-<number>`, then a PR comment with the preview URL. Preview builds set `PUBLIC_DEPLOY_ENV=preview`, which adds `noindex` to every page.
- Push to `main`: `wrangler deploy` in the GitHub Environment `production`; `concurrency` prevents overlapping deploys.
- Deploy jobs run only for branches of this repository, never for forks.
- First deploy: if the Worker does not exist yet, the preview job deploys once without `routes` (`scripts/ci/wrangler-bootstrap-config.ts`), so the custom domain is attached only by the first production deploy.
- `wrangler.jsonc`: `assets.directory: "./dist"`, `assets.not_found_handling: "404-page"` (the nearest `404.html` up the path: `/ru/…` gets `/ru/404.html`; `pnpm exec wrangler dev --local` emulates it, `astro preview` does not), default HTML handling (trailing slash, matching Astro), production only on the custom domain (`workers_dev: false`), preview URLs enabled. Check the current Wrangler docs for exact keys.
- Preview URLs live on the account's workers.dev subdomain (`pr-<n>-deutscherl.<subdomain>.workers.dev`); opening Workers & Pages in the dashboard once creates it.
- Secrets: `CLOUDFLARE_API_TOKEN` (least privilege: edit Workers for this account) and the variable `CLOUDFLARE_ACCOUNT_ID`, plus `CLAUDE_CODE_OAUTH_TOKEN` in the `claude-review` environment for the review. Nothing else is secret.
- Cloudflare "Always Use HTTPS" is on for the zone: http redirects to https (301) at the edge; HSTS is off.

## Analytics

Cloudflare Web Analytics with automatic setup: Cloudflare injects the beacon into HTML pages on the production domain (Web Analytics → the site → "Manage site" → "Enable"); preview URLs are not part of the zone. The build adds no beacon and holds no token, since a second beacon would count every visit twice (checked by an e2e test). No other analytics or tracking SDKs. Google Search Console is verified via a DNS record, no code.
