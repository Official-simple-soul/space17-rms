# space17 RMS

Requests, approvals and departmental reports for multiple organisations. Built with Next.js and Supabase.

## Run locally

Requires Node.js 24+, pnpm and Docker.

```sh
pnpm install
pnpm db:start
pnpm -s supabase status -o json | node scripts/write-local-env.mjs   # replaces .env.local
pnpm create-superadmin
pnpm dev
```

Open http://127.0.0.1:3100. Local email is at http://127.0.0.1:54324.

## Checks

| Command | Checks |
|---|---|
| `pnpm lint`, `pnpm typecheck` | Code quality |
| `pnpm test` | Unit tests |
| `pnpm test:db` | RLS and database rules |
| `pnpm test:e2e` | Browser flows; needs `pnpm exec playwright install chromium` |

## Structure

- `src/app`: routes only
- `src/features/<name>`: schemas, actions, repository and components for one domain
- `src/components`: shared UI and layout
- `src/lib`, `src/config`: infrastructure and environment
- `supabase/migrations`: tables, grants, policies and transactional functions

Planning documents are in [docs](docs/SCOPE.md).
