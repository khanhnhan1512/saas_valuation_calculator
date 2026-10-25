# Phase 01: Project setup & repo

## Context links
- [plan.md](plan.md) · spec `reports/00-spec-extracted.txt` (Architecture, env vars) · `research/researcher-01-backend-stack-report.md` (package list)
- `C:\Users\User\.claude\workflows\development-rules.md`
- Skills: `web-frameworks`, `docs-seeker` (verify Next/Auth.js/zod versions)

## Overview
- Date: 2026-10-25 · Priority: P0 (booth-critical, blocks all) · Status: Not started · Review: Not reviewed
- Scaffold Next.js App Router TS app in existing folder, git init, private GitHub repo, Vercel project linked (preview per PR, prod on main), base scripts, `.env.example`, minimal `docs/code-standards.md`.

## Key Insights
- Folder not empty (PDF, mp4, `plans/`): `create-next-app .` refuses non-allowlisted files → scaffold in temp sibling dir, copy in.
- Spec PDF/mp4 + screenshots = client material → keep out of git (`reference/`, screens, spec text gitignored). Repo private anyway.
- Next 16: `next lint` removed → use `eslint .`; middleware renamed `proxy.ts` (we use none). Turbopack default.
- Auth.js v5 beta peer deps vs Next 16: verify with `npm view next-auth@beta peerDependencies`; if conflict, pin Next 15.x latest.
- Build must not need DATABASE_URL (CI, previews without DB) → DB client lazy (phase 05).

## Requirements
- Functional: `npm run dev|build|start|lint|typecheck|test|test:e2e` work on empty app.
- Non-functional: no secrets in git; conventional commits; kebab-case files; files <200 lines.

## Architecture
```
D:\Downloads\saas_valuation_calculator\
  src/app  src/components  src/lib  src/hooks  src/config
  db/  public/  tests/unit  tests/e2e  docs/  reference/ (gitignored)  plans/
```
Git flow: `main` = production. One branch per phase `feat/phase-0X-<name>` → PR → Vercel preview → merge.

## Related code files
| Path | Action | Note |
|---|---|---|
| D:\Downloads\saas_valuation_calculator\package.json | create | scripts below, exact pins for next-auth |
| D:\Downloads\saas_valuation_calculator\tsconfig.json | create | strict, `@/*` → `src/*` |
| D:\Downloads\saas_valuation_calculator\next.config.ts | create | empty config now; headers in phase 05 |
| D:\Downloads\saas_valuation_calculator\eslint.config.mjs | create | from scaffold |
| D:\Downloads\saas_valuation_calculator\.gitignore | create | see step 6 |
| D:\Downloads\saas_valuation_calculator\.env.example | create | all env names, no values |
| D:\Downloads\saas_valuation_calculator\docs\code-standards.md | create | short: naming, <200 lines, config-only numbers, CSS `--u` rule |
| D:\Downloads\saas_valuation_calculator\reference\ | create | move PDF + mp4 here (gitignored) |
| D:\Downloads\saas_valuation_calculator\src\app\layout.tsx, page.tsx, globals.css | create | scaffold, strip boilerplate |

## Implementation Steps
1. Check tools: `node -v` (>=20.9 for Next 16), `npm -v`, `git --version`, `gh auth status`, `npx vercel --version`.
2. Move `SaaS_Valuation_Calculator_Technical_Specification.pdf` and `calculator_walkthrough.mp4` into `reference/`.
3. Scaffold in temp: `npx create-next-app@latest D:\Downloads\saas-calc-scaffold --ts --app --src-dir --eslint --no-tailwind --import-alias "@/*" --use-npm --turbopack` (answer no to React Compiler unless default). Copy everything except `node_modules`, `.git` into repo root; delete temp dir; `npm install`.
4. Strip boilerplate: delete `public/*.svg`, `src/app/page.module.css`, demo markup; `page.tsx` returns `<main>Calculator</main>`; delete scaffold `favicon.ico` later replaced in phase 07.
5. Add deps (verify versions with `npm view <pkg> version` first):
   - runtime: `@neondatabase/serverless@1 zod@4 exceljs@4.4.0 qrcode next-auth@5.0.0-beta.<latest> --save-exact` (next-auth exact)
   - dev: `vitest @types/qrcode @playwright/test` → `npx playwright install chromium webkit`
6. `.gitignore` additions: `.env*` + `!.env.example`, `/reference/`, `/plans/*/reports/screens/`, `/plans/*/reports/00-spec-extracted.txt`, `*.mp4`, `*.pdf`, `/test-results/`, `/playwright-report/`, `.vercel`.
7. `package.json` scripts:
   ```json
   "dev":"next dev","build":"next build","start":"next start","lint":"eslint .",
   "typecheck":"tsc --noEmit","test":"vitest run","test:e2e":"playwright test"
   ```
8. `.env.example`:
   ```
   DATABASE_URL=            # Neon pooled URL (Vercel Marketplace sets it)
   AUTH_SECRET=             # npx auth secret
   ALLOWED_EMAIL_DOMAIN=aspenval.com
   MS_TENANT_ID=
   MS_CLIENT_ID=
   MS_CLIENT_SECRET=
   STAFF_PASSWORD=          # optional booth fallback, >=20 random chars; remove once Entra live
   ```
9. Write `docs/code-standards.md` (<60 lines): kebab-case, <200 lines/file, all numbers/copy only in `src/config/*`, sizes via `calc(N * var(--u))`, no `location.reload()`, every staff route calls `requireStaff()`, conventional commits.
10. `git init -b main`; first commit `chore: scaffold next.js app`; `gh repo create <org>/saas-valuation-calculator --private --source . --push`.
11. Vercel: dashboard → Add New Project → import GitHub repo → framework Next.js → deploy (empty page). Confirm PR previews enabled. Functions region: Settings → Functions → `iad1` (matches Neon us-east-1). `npx vercel link` locally.
12. Run `npm run build && npm run lint && npm run typecheck` green; commit `chore: add tooling, env example, code standards`.

## Todo list
- [ ] Tool versions checked
- [ ] PDF/mp4 moved to reference/
- [ ] Scaffold copied, boilerplate stripped
- [ ] Deps installed, next-auth pinned exact, peer deps OK
- [ ] .gitignore / .env.example / scripts
- [ ] docs/code-standards.md
- [ ] git init + private GitHub repo pushed
- [ ] Vercel project imported, region iad1, first deploy green, `vercel link`

## Success Criteria
- `npm run build`, `lint`, `typecheck` pass; Vercel prod URL serves placeholder page; PR opens preview.
- `git ls-files` shows no PDF/mp4/.env/screens.

## Risk Assessment
- next-auth beta incompatible with latest Next → pin Next 15.x (App Router identical for our use).
- Windows path/line endings: add `.gitattributes` `* text=auto eol=lf`.
- Vercel Hobby = non-commercial → client must move to Pro before event (question 4).

## Security Considerations
- Private repo; no secrets committed; `.env.local` only via `vercel env pull`.
- Branch protection on main (require CI green) once CI exists (phase 08).

## Next steps
- Phase 02 (valuation core). Ask Aspen today: region (Q2), Entra (Q3), assets (Q10), Vercel plan (Q4).
