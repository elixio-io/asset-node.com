# PrimeVue v4 Migration Notes — automated pass (best-effort)

This file summarizes the automated migration pass I ran and the next manual/CI steps required to finish the upgrade to PrimeVue 4.x.

Branch: feat/upgrade/primevue-4
Compare/PR URL: https://github.com/elixio-io/asset-node.com/compare/main...tiiptaptoe:feat/upgrade/primevue-4?expand=1

Migration resources
- PrimeVue v4 Migration Guide: https://primefaces.org/primevue/migration-v4
- PrimeVue Releases / Changelog: https://github.com/primefaces/primevue/releases
- v4 Component Changes (wiki): https://github.com/primefaces/primevue/wiki/v4-Component-Changes

What I did (automated, safe edits only)
1. Bumped package.json dependencies to the targeted versions:
   - primevue -> ^4.5.5
   - @primevue/themes -> ^4.5.5
   - primeflex -> ^4.0.1
   - primeicons -> ^7.0.1
   Commit: chore(deps): bump PrimeVue & related packages to 4.5.5

2. Created a PR draft file and the checklist to drive the migration.

3. Performed a static scan to find files importing PrimeVue components so we can prioritize manual checks.

Files that import from 'primevue/*' (static scan — results may be incomplete; see code search link below):
- src/main.ts
- src/App.vue
- src/views/Kits.vue
- src/views/Components.vue
- src/views/Assignments.vue
- src/views/Labels.vue
- src/views/Defective.vue
- src/views/Available.vue
- src/views/Profile.vue
- src/views/Admin.vue
- src/views/ForgotPassword.vue
- src/views/Maintenance.vue
- src/views/Import.vue

(There are additional components under src/components and other views that import primevue components — run the repository code search to see the full list.)

Repository code search link (may be truncated to 10 results by the UI):
https://github.com/tiiptaptoe/asset-node.com/search?q=from+%27primevue%2F&type=code

Automated changes I did NOT make (on purpose to avoid risky edits)
- I did not change runtime code in src/main.ts beyond the dependency bump.
- I did NOT change component prop names, slot names, or event names because those changes can be subtle and often require runtime verification and visual QA.
- I did NOT change theme SASS imports or rework theming; SASS-based theme migrations require building styles and are environment-specific.

Recommended next steps (what I will do next if you want B: automated migration pass + fixes)
1. Run the baseline locally or in CI (required):
   - git fetch origin && git checkout feat/upgrade/primevue-4
   - npm install
   - npm run test
   - npm run lint
   - npm run build
   - npm run dev
   Collect logs from failing tests/build errors and paste them here.

2. I will apply targeted code fixes (a non-exhaustive list):
   - Update any removed/renamed props listed in the v4 changelog (e.g., certain MultiSelect props, InputNumber wrappers) where they appear.
   - Adjust tooltip directive usage only if runtime errors indicate a problem.
   - Ensure useToast/usetoast usage is correct (imports remain `primevue/usetoast`).
   - Update theme import/usage if errors indicate the theme preset API changed.

3. I will run a follow-up static pass to update component imports/usages where migration guide lists exact renames.

4. I will update unit tests and e2e tests (Cypress) to match updated DOM/selectors if necessary.

5. After CI passes locally, I will update this branch with all fixes and prepare the Draft PR for upstream.

What I need from you now
- Confirm you want me to continue with the targeted automated fixes (I will push commits to this branch). Reply: `Continue with fixes`.
- Or run the baseline commands locally and paste logs here (safer) and I will fix the issues you report. Reply: `I will run baseline`.

Notes about limitations
- I cannot run npm install, build, or tests in this environment — those must be executed in your dev environment or CI. Any code fixes I apply here are based on static analysis and the official migration guide; runtime errors will likely require iterations.

If you want me to proceed automatically, reply `Continue with fixes` and I’ll begin updating source files where the migration guide lists explicit breaking changes that can be safely applied statically. I will not add any GitHub Actions or agents as per your instruction.
