# Contributing to Grantees and Fellows Map and Programming

This project is an **internal Foresight Institute tool**. If you've been invited to contribute, this document explains how to collaborate, report issues, and submit changes.

## Code of conduct

By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to contribute

- **Report bugs** — Open an [issue](https://github.com/bradleycr/Foresightmap/issues) with a clear description and steps to reproduce.
- **Suggest features** — Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml) so we can discuss scope and design.
- **Improve docs** — Fix typos, clarify setup, or add examples via pull requests.
- **Submit code** — Follow the steps below for pull requests.

## Development setup

1. **Clone the repo** (you should have access if you're an invited contributor)

   ```bash
   git clone https://github.com/bradleycr/Foresightmap.git
   cd Foresightmap
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Run locally**

   ```bash
   pnpm dev:all
   ```

   Frontend: [http://localhost:3000](http://localhost:3000). API: [http://localhost:3001](http://localhost:3001).

   Optional: copy `.env.example` to `.env.local` and set sheet credentials (e.g. `GOOGLE_SHEETS_API_KEY`, `SPREADSHEET_ID`). The app loads data from GET /api/database (Google Sheet); no static database.json at runtime.

4. **Project context**

   - See [AGENTS.md](AGENTS.md) for naming, services, and caveats.
   - See [docs/SHEETS_SYNC.md](docs/SHEETS_SYNC.md) for Google Sheet setup.
   - Frontend reads only from `/api/database`; the API reads from the sheet.

## Pull request process

1. **Branch** — Create a branch from `main` (e.g. `fix/typo-readme` or `feat/filter-by-node`).
2. **Changes** — Keep PRs focused. One logical change per PR is easier to review.
3. **Commit messages** — Use clear, present-tense messages (e.g. "Add CONTRIBUTING.md", "Fix map centering on mobile").
4. **Open a PR** — Use the [pull request template](.github/PULL_REQUEST_TEMPLATE.md). Link any related issues.
5. **Review** — Maintainers will review and may request changes. Once approved, your PR will be merged.

## Code and style

- **TypeScript** — The app is React + TypeScript. Keep types accurate; avoid `any` where avoidable.
- **Modularity** — Prefer small, focused components and clear separation of concerns.
- **Mobile** — Ensure changes work on mobile as well as desktop; the app is responsive.
- **No linter/test runner** — The project does not currently run ESLint or tests in CI. Please run `pnpm build` before submitting to ensure the project builds.

## Questions

Open a [Discussion](https://github.com/bradleycr/Foresightmap/discussions) or an issue if something is unclear. Maintainers are happy to help.

Thanks for contributing.
