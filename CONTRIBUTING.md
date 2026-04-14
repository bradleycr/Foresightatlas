# Contributing

Thank you for helping improve this project. By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report bugs** — Open an [issue](https://github.com/bradleycr/Foresightmap/issues) with reproduction steps.
- **Suggest features** — Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml) where applicable.
- **Documentation** — Fixes and clarifications in `docs/` and root READMEs are welcome.
- **Code** — Pull requests: keep them focused; one logical change per PR is easiest to review.

## Development setup

1. **Clone and install**

   ```bash
   git clone https://github.com/bradleycr/Foresightmap.git
   cd Foresightmap
   pnpm install
   ```

2. **Environment** — Copy `.env.example` to `.env.local` and add sheet credentials so `GET /api/database` works. See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

3. **Run**

   ```bash
   pnpm dev        # Vite + API (recommended)
   # or
   pnpm dev:all    # Includes Signal poller when Signal env vars are set
   ```

   Frontend: [http://localhost:3000](http://localhost:3000). API: [http://localhost:3001](http://localhost:3001).

4. **Context**

   - [AGENTS.md](AGENTS.md) — Ports, naming, and caveats.
   - [docs/README.md](docs/README.md) — Index of setup, deploy, Signal, Luma, sheets.

## Focus areas for collaborators

- **Signal check-in bot** — Behavior and setup: [docs/SIGNAL_CHECKIN_SETUP.md](docs/SIGNAL_CHECKIN_SETUP.md), code under `server/signal/`. The bot is optional; the app runs without it.
- **API compatibility** — If you work on the backend, see [src/INTEGRATION.md](src/INTEGRATION.md) for how the frontend expects `/api` to behave and how a partner-hosted API can sit behind the same UI.

## Pull request process

1. Branch from `main` (e.g. `fix/map-tooltip`, `feat/signal-retry`).
2. Use clear, present-tense commit messages.
3. Open a PR using [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
4. Run `pnpm build` before submitting (there is no CI linter/test gate in this repo yet).

## Code and style

- TypeScript on the frontend; match existing patterns and keep types honest.
- Prefer small modules and responsive, mobile-friendly UI.
- Avoid drive-by refactors unrelated to your change.

## Questions

Use [Discussions](https://github.com/bradleycr/Foresightmap/discussions) or issues if something is unclear.

Thanks for contributing.
