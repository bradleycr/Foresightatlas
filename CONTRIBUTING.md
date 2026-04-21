# Contributing

Thank you for helping improve this project. By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). **Contributions are licensed under the [MIT License](LICENSE)** (same as the rest of the repo).

## Ways to contribute

- **Report bugs** — Open an [issue](https://github.com/bradleycr/foresightatlas/issues); use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml) when it helps.
- **Suggest features** — Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml) or a clear free-form issue.
- **Documentation** — Fixes and clarifications in `docs/`, `README.md`, and `AGENTS.md` are welcome.
- **Code** — Pull requests should be **focused** (one logical change per PR is easiest to review).

## Development setup

1. **Fork and clone** (or clone directly if you have access)

   ```bash
   git clone https://github.com/bradleycr/foresightatlas.git
   cd foresightatlas
   pnpm install
   ```

2. **Environment (optional for first-time UI work)**

   - **With Google Sheet access** — Copy `.env.example` to `.env.local` and add credentials so `GET /api/database` hits your sheet. See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).
   - **Without sheet credentials** — `pnpm dev` still starts the app: `scripts/start-dev.js` selects a **file-backed mock API** (`server/index.mock.js`) and data under `mock/`. You can work on UI and many flows without sharing production keys.

3. **Run**

   ```bash
   pnpm dev        # Vite + API (recommended)
   pnpm dev:api    # API only on port 3001
   pnpm dev:all    # Frontend + API + Signal poller (only if Signal env vars are set)
   ```

   - Frontend: [http://localhost:3000](http://localhost:3000)
   - API: [http://localhost:3001](http://localhost:3001) (`/api` is proxied from Vite during `pnpm dev`)

4. **Before you open a PR**

   ```bash
   pnpm build
   ```

   There is **no** ESLint or automated test script in this repo yet; a clean production build is the main automated check.

5. **Context**

   - [AGENTS.md](AGENTS.md) — Ports, naming, sheet-as-source-of-truth, mock behavior (also useful for AI-assisted editing).
   - [docs/README.md](docs/README.md) — Index of architecture, sheets, Vercel, Signal, Luma.

## Focus areas for collaborators

- **Signal check-in bot** — Optional. [docs/SIGNAL_CHECKIN_SETUP.md](docs/SIGNAL_CHECKIN_SETUP.md), code under `server/signal/`.
- **API / backend** — [src/INTEGRATION.md](src/INTEGRATION.md) describes expected `/api` shapes if you swap or extend the server.

## Pull request process

1. Branch from `main` (e.g. `fix/map-tooltip`, `feat/programming-filter`).
2. Use clear commit messages (present tense is fine).
3. Open a PR against `main` and fill in [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
4. Confirm `pnpm build` succeeds.

Maintainers will review when they can; smaller PRs tend to merge faster.

## Code and style

- TypeScript on the frontend; match existing patterns and keep types accurate.
- Prefer responsive, mobile-friendly UI consistent with the rest of the app.
- Avoid unrelated drive-by refactors in the same PR as a feature or fix.

## Questions

Open a [GitHub issue](https://github.com/bradleycr/foresightatlas/issues) for concrete bugs or tasks. If the repo has **Discussions** enabled, you can use those for broader questions.

Thanks for contributing.
