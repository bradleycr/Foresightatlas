# Vercel CLI (this repo)

The **Vercel CLI** is a dev dependency. Use it to link the repo, manage env vars, and deploy without opening the dashboard for every change.

## One-time on your machine

1. **Log in** (opens the browser):

   ```bash
   pnpm run vercel:login
   ```

2. **Link this directory** to your Vercel project (creates `.vercel/` — gitignored here):

   ```bash
   pnpm run vercel:link
   ```

   Pick team + project when prompted.

3. **Optional — pull env into a local file** (never commit secrets):

   ```bash
   pnpm run vercel:pull
   ```

   Reads project env from Vercel into `.env.vercel.local` (add that filename to `.gitignore` if you use it — it is not in the repo by default).

## Verify CLI + project (any time)

From the repo root:

```bash
pnpm run vercel:status
```

This prints the logged-in Vercel user and lists **variable names** (not values) for the linked project. You should see **SPREADSHEET_ID** and **GOOGLE_SERVICE_ACCOUNT_KEY** at minimum for sheet-backed production; see [VERCEL_ENV.md](./VERCEL_ENV.md) for the full checklist.

If you are not logged in, run `pnpm run vercel:login` first. If the project is not linked, run `pnpm run vercel:link` (creates `.vercel/` locally; it is gitignored).

## Common commands

| Goal | Command |
|------|---------|
| Whoami + env names | `pnpm run vercel:status` |
| Deploy preview | `pnpm run vercel:deploy` |
| Deploy production | `pnpm run vercel:prod` |
| List env names | `pnpm exec vercel env ls` |
| Add a variable | `pnpm exec vercel env add VARIABLE_NAME production` |

When adding a key, paste the value when prompted.

See also [VERCEL_ENV.md](./VERCEL_ENV.md) for which variables to set.

## Automation / agents (token)

For **non-interactive** use (CI or tooling), create a token at [Vercel → Account → Tokens](https://vercel.com/account/tokens), then:

```bash
export VERCEL_TOKEN=your_token_here
pnpm exec vercel env ls
pnpm exec vercel --prod --token "$VERCEL_TOKEN"
```

The linked project in `.vercel/project.json` is used when present; otherwise pass `--scope <team>` and ensure the cwd is correct.

**Security:** Treat `VERCEL_TOKEN` like a password; do not commit it. Prefer Vercel’s **GitHub integration** for deploys and use tokens only for scripts.
