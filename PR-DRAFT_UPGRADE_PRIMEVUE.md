PR Title: feat: upgrade/primevue-4 — bump PrimeVue & related packages and start migration

Target: elixio-io/asset-node.com main
Branch: tiiptaptoe/asset-node.com:feat/upgrade/primevue-4

Summary

- This branch bumps PrimeVue and related packages to the latest PrimeVue 4.x releases (primevue v4.5.5, @primevue/themes v4.5.5, primeicons v7.0.1, primeflex v4.0.1). The dependency change was committed to package.json.
- This draft documents the checklist and next steps for a full migration. I have NOT modified runtime code besides the dependency bump in this commit — further code fixes will be applied iteratively after test results are visible.

Links
- Upstream issue: https://github.com/elixio-io/asset-node.com/issues/1
- PrimeVue v4 Migration Guide: https://primefaces.org/primevue/migration-v4
- PrimeVue Releases / Changelog: https://github.com/primefaces/primevue/releases

Compare / create PR (use this link to open the PR from your fork):
https://github.com/elixio-io/asset-node.com/compare/main...tiiptaptoe:feat/upgrade/primevue-4?expand=1

Repository code search (PrimeVue usages) — results may be incomplete: 
https://github.com/tiiptaptoe/asset-node.com/search?q=from+%27primevue%2F&type=code

Checklist (copy into PR description or use as a checklist for the issue)

- [ ] Record current versions & test baseline
    - Run `cat package.json` and `npm ls primevue vue primeicons` to capture baseline versions
    - Run test suite and record failing tests, if any (`npm run test`)

- [ ] Read migration guide & paste relevant notes
    - PrimeVue migration guide: https://primefaces.org/primevue/migration-v4
    - PrimeVue changelog: https://github.com/primefaces/primevue/releases

- [ ] Create branch feat/upgrade/primevue-4 (done)

- [ ] Upgrade dependencies and run install (done for package.json; run `npm install` locally or in CI)

- [ ] Fix lint and unit test failures
    - Run `npm run lint` and `npm run test` locally/CI and capture failures

- [ ] Update components for breaking changes
    - Search the codebase for PrimeVue components and update imports/props/events/slot names per migration guide
    - Common places to check: `src/main.ts` (PrimeVue config / theme), components and views that import PrimeVue components

- [ ] Update themes/CSS imports
    - Verify theme preset import and usage in `src/main.ts` — adjust if the theme API changed

- [ ] Update unit / e2e tests
    - Adjust test selectors or assertions if DOM changed
    - `npm run test` and run Cypress e2e if configured

- [ ] Deploy to staging and QA
    - Run build: `npm run build`
    - Deploy branch to staging and run smoke checks

- [ ] Merge and monitor production
    - After CI + staging signoff, merge and monitor post-deploy

- [ ] Close issue and add release notes

Files changed in this branch so far
- package.json — dependency bumps for PrimeVue + related packages

How I can help next (pick one)
- I can open the Draft PR using the compare link above (I cannot open PRs directly in the upstream repo from this environment, but you can open it with one click using the compare URL). If you want, I can prepare a ready-made PR body you can paste into the PR form.
- I can run an automated code-migration pass and push code fixes to this branch (best-effort). I will NOT add Actions/workflows/agents to your fork.
- I can wait while you run `npm install` / `npm run test` and paste any failing logs/errors here, then I’ll fix them and push follow-up commits to this branch.

Notes
- I will NOT create any GitHub Actions workflows or Copilot agents in your fork unless you explicitly ask me to.
- Search results for PrimeVue imports may be incomplete; view them here: https://github.com/tiiptaptoe/asset-node.com/search?q=from+%27primevue%2F&type=code

Suggested PR template content (copy into PR body)

---

Summary

Bumps primevue, @primevue/themes, primeicons, and primeflex to the latest PrimeVue 4.x releases and starts the migration process. This PR currently contains only the dependency update and the migration checklist. I will follow up with code fixes once CI/local tests surface issues.

Checklist (as above)

---

