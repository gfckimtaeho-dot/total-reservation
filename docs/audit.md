# Audit columns (who/when created & modified)

## Rule

Every table — existing and any new one — must carry four audit columns:

- `createdAt  DateTime @default(now()) @db.Timestamptz(3)` — row creation time
- `updatedAt  DateTime @updatedAt @db.Timestamptz(3)` — last modification time
- `createdById String?` — user id of the account that created the row
- `updatedById String?` — user id of the account that last modified the row

`createdById`/`updatedById` are plain `String?` (the user id), intentionally
**not** Prisma relations — adding 2 FK relations × 38 models would explode the
`User` back-relations for no functional gain. Resolve the name at display time
if needed.

When adding a new model, include all four. `prisma format` + `prisma db push`
(this project syncs the single Neon via `db push`; the `migrations/` folder is
frozen at m5 — do **not** run `prisma migrate dev`, it sees drift and tries to
reset the prod DB).

## How stamping works (no per-action code)

`src/lib/db/client.ts` wraps the base Prisma client with a `$extends` query
extension over `$allModels`. On `create`, `createMany`, `update`, `updateMany`,
`upsert` it injects:

- create paths → `createdById` and `updatedById` = current account (only if not
  explicitly set by the caller)
- update paths → `updatedById` = current account

`createdAt`/`updatedAt` are handled by Prisma (`@default(now())` / `@updatedAt`)
— the extension never touches them.

"Current account" comes from `src/lib/audit/actor.ts → currentActorId()`, which
lazily calls `verifySession()` (React.cache, one cookie+DB read per request; a
read, so it does not recurse the write extension). The lazy dynamic import
breaks the `client.ts ↔ dal.ts` cycle.

Outside a request (scripts, build, cron) `cookies()` throws → caught → actor is
`null` → the row is stamped as system-created (`createdById`/`updatedById`
null). That is expected and acceptable.

The extension also applies inside interactive `$transaction(async (tx) => …)`
callbacks, so transactional writes are stamped too.

## Consequences / gotchas

- Callers never pass `createdById`/`updatedById` manually; if they do, the
  explicit value is preserved on create.
- Bulk `updateMany` stamps `updatedById` for the whole batch with the current
  account.
- A new model with audit columns needs no action wiring — the blanket
  extension covers it automatically.
- Do not add query-extension keys for `find*` — reads must not be intercepted
  (keeps `verifySession` from recursing).
