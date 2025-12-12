# Repository Guidelines

## Project Structure & Module Organization
- Base path: `D:\catat_sales`.
- Primary directories (confirm as applicable): `src/` (app code by domain), `tests/` (unit/integration), `assets/` (static/media), `scripts/` (local tooling), `docs/` (project notes), `config/` (env and app config). Keep modules small, cohesive, and named for their responsibility (e.g., `src/orders/`, `src/customers/`).

## Build, Test, and Development Commands
- Install deps: use the project’s package manager (e.g., `npm ci`, `pip install -r requirements.txt`, or `poetry install`).
- Run locally: `npm run dev`, `python -m app`, or framework-specific task if provided in `README.md`/scripts.
- Build: `npm run build`, `make build`, or framework build tool.
- Test: `npm test`/`pnpm test` or `pytest -q`.
Check `README.md`, `package.json`, `pyproject.toml`, or `Makefile` for exact scripts.

## Coding Style & Naming Conventions
- Indentation: 4 spaces; wrap at ~100 chars.
- Names: descriptive, lowercase for folders; prefer `snake_case` for Python files, `kebab-case` for web assets, and `PascalCase` for classes.
- Formatting/Linting (if configured): run via scripts, e.g., `npm run lint`, `ruff check`, `black .`, or `prettier --check .`. Do not commit formatting noise unrelated to the change.

## Testing Guidelines
- Unit tests live under `tests/` mirroring source layout.
- Naming: `test_*.py` (Python) or `*.spec.ts`/`*.test.js` (JS/TS).
- Aim for meaningful coverage of business rules; add regression tests for bugs.
- Run the full test suite before opening a PR.

## Commit & Pull Request Guidelines
- Commits: small, focused, and imperative. Prefer Conventional Commits when possible (e.g., `feat: add customer search`/`fix: handle empty orders`).
- PRs: include a clear description, linked issues (e.g., `Closes #123`), reproduction/verification steps, and screenshots for UI changes. Keep diff size manageable.

## Security & Configuration Tips
- Use `.env` for local secrets and provide a sanitized `.env.example`. Never commit credentials or tokens.
- Prefer environment variables for configuration; document required keys in `README.md`.

