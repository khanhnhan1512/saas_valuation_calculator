# Code standards

- TypeScript strict. File names in kebab-case. Keep files under 200 lines.
- **Numbers and copy live only in `src/config/`.** Components and libs import them; no magic numbers elsewhere.
- Valuation math runs in the browser and on the server from the same `src/lib/valuation.ts`. Never trust numbers sent by the browser.
- Sizes in CSS scale with the viewport: `calc(N * var(--u))`, where `--u` is 1px at 1366 x 768. Colors come from tokens in `globals.css`.
- Never call `location.reload()` to reset. Reset state in memory, so the offline queue and an offline page survive.
- Every staff route checks the session itself (`requireStaff()`); never rely on middleware alone.
- Never log personal data. Log error classes or ids only.
- Tests run against real Postgres (PGlite) and the real production build; no mocked API in E2E.
- Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Run `lint`, `typecheck`, `test` before pushing.
