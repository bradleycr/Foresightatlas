# Generated reports (local only)

Some maintainer scripts write markdown or CSV here so **audit and migration reports are not committed** to the repo.

| Command | Output |
|---------|--------|
| `pnpm run audit:realdata` | `REALDATA_AUDIT_REPORT.md` |
| `pnpm run compare:sheet` | `DATA_COMPARISON_DOSSIER.md` |
| `pnpm run copyover-report` | `REAL_DATA_COPYOVER_REPORT.md` |
| `pnpm run copyover-report:csv` | `REAL_DATA_COPYOVER.csv` |

The `reports/` directory is gitignored except for this file.
