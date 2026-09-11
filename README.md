# jellycrew

Self-hosted user management for a single Jellyfin server: access, profiles, lifecycle rules, invites, self-service password reset and an audit trail. Jellyfin stays the source of truth for users, policies, sessions and devices; jellycrew owns only what Jellyfin cannot.

Status: under construction, built in stages (see `SPEC.md` and `DECISIONS.md`).

## Development

Requirements: Node 22, pnpm, Docker (integration tests start real Jellyfin and Mailpit containers).

```bash
pnpm install
pnpm tsx scripts/dev-jellyfin.ts      # starts a disposable Jellyfin 10.11 and prints JELLYFIN_URL / JELLYFIN_API_KEY
cp .env.example .env.local            # fill in the values printed above and a SESSION_SECRET
pnpm dev
```

```bash
pnpm test               # unit + integration
pnpm test:unit
pnpm test:integration   # needs Docker
pnpm build
pnpm lint && pnpm typecheck
pnpm db:generate        # after editing lib/db/schema.ts
pnpm jellyfin:gen       # regenerate the OpenAPI snapshot and client types
```
