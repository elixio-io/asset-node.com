<!--
Thanks for contributing. A couple of things that will get a PR closed unread,
so worth checking before you go further:

  - Commits must be signed off (`git commit -s`). This carries a licensing
    grant described in CONTRIBUTING.md — please read that section.
  - Files containing `.ee.` or under `.ee` directories are commercially
    licensed and must not be modified.
-->

## What this changes

<!-- One or two sentences. The diff shows what; this should say why. -->

## Related issue

<!-- e.g. Closes #123. If there is no issue and this is a non-trivial change,
     say why you went straight to a PR. -->

## How you verified it

<!-- What you actually ran, and what you saw. "Tests pass" is weaker than
     "reproduced the 409 on a serial-less asset, applied the fix, second asset
     now saves". -->

- [ ] `npm test`
- [ ] `npx vue-tsc --noEmit -p tsconfig.json`
- [ ] `npx vite build`

<!-- If this touches a database index, a query middleware, or anything relying
     on uniqueness, please verify against a real MongoDB rather than only the
     test suite. AGENTS.md explains why: soft-deleted documents stay in unique
     indexes while being invisible to model queries, and Mongoose never alters
     an existing index. Both have shipped bugs past a green suite here. -->

## Checklist

- [ ] Commits are signed off (`git commit -s`)
- [ ] Tests added or updated for behaviour I changed
- [ ] Existing tests, typecheck and build all pass
- [ ] I did not modify `.ee.` / `.ee` files
- [ ] AI-assisted? `Assisted-by:` trailer added, and I have read and understood the diff
