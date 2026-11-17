# EZ-Split API (Cloudflare Worker)

One Worker serves the AI endpoints and a small data backend in Cloudflare D1.
There are no accounts: each phone registers itself silently and gets a secret key,
which the app shows as a **recovery code** (Groups → cloud icon).

## Routes

| Route | Auth | What it does |
|---|---|---|
| `POST /parse-receipt`, `/draft-reminder`, `/explain-split` | app token | AI features |
| `POST /devices` | app token | Registers a phone, returns its key |
| `GET` / `PUT /backup` | device key | Reads / replaces this phone's backup |
| `POST /shares` | device key | Makes a share link for a bill |
| `POST /shares/status` | device key | Who has paid, for several of this phone's links |
| `PUT /shares/:id`, `DELETE /shares/:id` | device key (owner) | Updates / removes a link |
| `PUT /shares/:id/paid` | device key (owner) | Marks someone paid or not paid |
| `GET` / `POST /s/:id` | none (the link is the key) | Public bill page with "I've paid" buttons |

Only a SHA-256 of each device key is stored. Friends on the public page can mark
themselves paid but can't undo it; only the owner's app can.

## First-time setup

```sh
npm ci
npx wrangler d1 create ez-split          # paste the printed id into wrangler.jsonc (database_id)
npx wrangler d1 migrations apply ez-split --remote
npx wrangler secret put APP_TOKEN
npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

## Local development

```sh
npx wrangler d1 migrations apply ez-split --local
npm run dev                               # reads secrets from .dev.vars
```

Point the app's `EXPO_PUBLIC_API_URL` at the dev server. Share links use the same address,
so for friends to open them on their phones it must be reachable from their network.

## Tests

```sh
npm test            # uses Node's built-in SQLite with the real migration in place of D1
npm run typecheck
```

New schema changes go in a new numbered file in `migrations/`, never by editing an applied one.
