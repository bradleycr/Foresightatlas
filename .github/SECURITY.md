# Security policy

## Supported versions

We release updates for the current major version. Security fixes may be backported when practical.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x  | :white_check_mark: |

## Reporting a vulnerability

If you believe you’ve found a security vulnerability, please report it responsibly:

- **Do not** open a public issue for security-sensitive bugs.
- Open a **private** security advisory on GitHub: [Security tab → Advisories → New draft security advisory](https://github.com/bradleycr/Foresightatlas/security/advisories/new).

Include:

- A clear description of the issue and steps to reproduce.
- The impact (e.g. data exposure, privilege escalation).
- Any suggested fix or mitigation, if you have one.

We will acknowledge your report and work with you on a fix and disclosure timeline. We appreciate your help in keeping the project and its users safe.

## What is intentionally private

This repository is public; **production roster data is not**. Spreadsheet IDs, service-account keys, session secrets, and member PII must never be committed or pasted into public issues. Use the mock API (`pnpm dev` without Google keys) for contribution workflows.
