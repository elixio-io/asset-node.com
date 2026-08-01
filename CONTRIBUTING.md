# Contributing to AssetNode

Thanks for considering a contribution. This document covers how to get set up, what we merge, and the
licensing terms your contribution is made under. Please read the [licensing section](#licensing-of-your-contribution)
before you open a pull request — it is short, and it matters.

## Getting set up

Requires Node 20+ and MongoDB.

```bash
npm install
cp .env.example .env        # set MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET
npm run db:setup
npm run dev:all             # front end :5173, API :3001
```

`npm run dev:mock` runs all third-party integrations (Jamf, Kandji, Intune, …) against mocked APIs, so you can
work on integration code without any vendor credentials.

## Finding something to work on

- [`good first issue`](https://github.com/elixio-io/asset-node.com/labels/good%20first%20issue) — scoped, with
  reproduction steps and a pointer to the relevant files
- [`help wanted`](https://github.com/elixio-io/asset-node.com/labels/help%20wanted) — larger, still well-defined
- Anything else: **open an issue first.** For non-trivial changes, agreement on the approach before you write
  code saves everyone a wasted review cycle.

Bug reports are more useful than you might think. A clear reproduction is a real contribution.

## What we merge

- **Tests for behaviour you change.** The suite runs on `npm test` and must be green. Tests here are mostly
  pure-logic; if you touch a database index or a schema constraint, verify it against a real MongoDB rather
  than only asserting on a re-implementation of the logic.
- **Match the surrounding code.** Naming, comment density, and idiom should look like the file you are editing.
- **One concern per pull request.** A focused diff gets reviewed; a 40-file refactor stalls.
- **Explain the "why" in the description.** The diff already shows the "what".

Run before pushing:

```bash
npm test
npx tsc --noEmit -p tsconfig.json
```

## Commits and pull requests

Conventional-commit style is preferred (`fix(hardware): …`, `feat(workflows): …`) but not enforced. Write the
body to explain the reasoning, not to restate the diff.

Every commit must carry a `Signed-off-by` line:

```bash
git commit -s -m "fix(assets): keep serial numbers unique while allowing serial-less assets"
```

## Licensing of your contribution

AssetNode is **fair-code** under the [Sustainable Use License](LICENSE.md), and Elixio UG additionally offers
commercial and Enterprise licences. Revenue from those licences is what funds development.

For that to be legally possible, we need broader rights to your contribution than the Sustainable Use License
alone grants. So, by signing off a commit (`git commit -s`), you certify the
[Developer Certificate of Origin](https://developercertificate.org/) **and** you agree that:

1. You own the copyright in your contribution, or have the right to submit it under these terms.
2. You grant Elixio UG (haftungsbeschränkt) a perpetual, worldwide, non-exclusive, royalty-free, irrevocable
   licence to use, reproduce, modify, sublicense, and distribute your contribution, **including as part of
   commercially licensed or Enterprise versions of AssetNode**.
3. You retain full copyright in your contribution and remain free to use it however you like elsewhere.

This is a standard arrangement for commercially maintained open projects. We are stating it plainly because
you deserve to know what you are agreeing to before you spend your time — not after.

If your employer owns your work output, get their sign-off before contributing.

**Not comfortable with the commercial grant?** That is a legitimate position. Open an issue with a detailed bug
report or a design proposal instead — that is genuinely valuable and carries no licensing implications.

## Automated and AI-assisted contributions

**Point your agent at [AGENTS.md](AGENTS.md) first.** It carries the commands, the architecture map, and the
non-obvious constraints — soft-deleted rows still occupying unique indexes, Mongoose never altering an
existing index, tenancy scoping — that an agent cannot infer from the source and will otherwise get wrong
with confidence.

AI-assisted pull requests are welcome. They are held to exactly the same bar as any other, plus two rules:

1. **A human signs off and is accountable.** The `Signed-off-by` line must be a person who has read the diff,
   understands it, and can answer review questions about it. An agent may write the code; a human takes
   responsibility for it.
2. **Disclose it.** Add `Assisted-by: <tool>` in the commit trailer. This is not held against you.

We will close, without review, bulk or drive-by pull requests that show no evidence of the change having been
run or understood — dependency-version churn, mass reformatting, speculative refactors, and README typo floods
generated at volume. They cost maintainer attention that would otherwise go to real contributors.

If you are operating an agent and want a larger scoped task, open an issue and ask. We would rather point you
at something genuinely useful than have you guess.

## Reporting security issues

**Do not open a public issue for a security vulnerability.** See [SECURITY.md](SECURITY.md) or email
[alexander.vonhohnhorst@elixio.io](mailto:alexander.vonhohnhorst@elixio.io).

## Where to contribute

[GitHub](https://github.com/elixio-io/asset-node.com) and [Codeberg](https://codeberg.org/elixio/asset-node.com)
are kept in sync. Use whichever you prefer — issues and pull requests are accepted on both.
