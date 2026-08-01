<div align="center">

# AssetNode

**Open IT asset management for teams who outgrew the spreadsheet.**

Track hardware, software licences, and who has what — across the full asset lifecycle.

[Website](https://asset-node.com) · [Hosted version](https://app.asset-node.com) · [Blog](https://asset-node.com/blog) · [Bluesky](https://bsky.app/profile/elixio.bsky.social)

</div>

---

## What it does

AssetNode is an IT asset management (ITAM) platform. It answers the questions that get expensive when nobody
can answer them: which laptop is assigned to whom, what falls out of warranty next quarter, which licences
are being paid for and not used, and what has to come back when someone leaves.

- **Hardware inventory** — assets, serial numbers, asset tags, categories, statuses, custom fields
- **Assignments** — who holds which device, with full history and audit trail
- **Lifecycle** — purchase, warranty, depreciation, maintenance, end-of-life, buyback
- **Software licences** — seats, renewals, cost tracking
- **Employees & onboarding** — departments, direct reports, joiner/leaver flows
- **Workflows** — event-driven automation with a visual builder
- **Integrations** — Jamf, Kandji, Intune, Autopilot, Mosyle, SCIM provisioning
- **Compliance** — audit logs, GDPR export and deletion, role-based access

Built for the EU: data model, retention, and export paths are designed around GDPR rather than bolted on.

## Stack

Vue 3 + TypeScript on the front end, Fastify + MongoDB (Mongoose) on the back end, Vite for builds, Vitest
for tests. Deployed as a single container.

## Quick start

Requires Node 20+ and a MongoDB instance.

```bash
git clone https://github.com/elixio-io/asset-node.com.git
cd asset-node.com
npm install

cp .env.example .env        # then set MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET
npm run db:setup            # create indexes and system defaults
npm run db:seed             # optional: demo data

npm run dev:all             # front end on :5173, API on :3001
```

No MDM credentials to hand? `npm run dev:mock` runs every integration against mocked APIs.

### Docker

```bash
docker compose -f docker-compose.dev.yml up
```

## Tests

```bash
npm test              # full suite
npm run test:watch    # watch mode
npm run test:coverage
```

## Licence

AssetNode is **fair-code**, distributed under the [Sustainable Use License](LICENSE.md).

In plain terms:

| | |
|---|---|
| ✅ | Use it free, forever, for your own internal business purposes |
| ✅ | Self-host it for your own company, at any scale |
| ✅ | Read, modify, and extend the source |
| ✅ | Share it, free of charge, for non-commercial purposes |
| ❌ | Resell it, or offer it to third parties as a hosted/managed service |

Files marked `.ee.` or under an `.ee` directory are commercial and need an Enterprise Licence.

If you want to offer AssetNode commercially, or need terms the Sustainable Use License does not cover, get in
touch: [alexander.vonhohnhorst@elixio.io](mailto:alexander.vonhohnhorst@elixio.io)

Prefer not to run it yourself? The [hosted version](https://app.asset-node.com) funds development.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Start with issues labelled
[`good first issue`](https://github.com/elixio-io/asset-node.com/labels/good%20first%20issue).

Mirrors: [GitHub](https://github.com/elixio-io/asset-node.com) · [Codeberg](https://codeberg.org/elixio/asset-node.com).
Both are kept in sync; open issues and pull requests on whichever you prefer.

## Security

Please do not report security issues in public issues. See [SECURITY.md](SECURITY.md), or email
[alexander.vonhohnhorst@elixio.io](mailto:alexander.vonhohnhorst@elixio.io) directly.

---

AssetNode is built by [Elixio UG (haftungsbeschränkt)](https://asset-node.com/imprint) in Bonn, Germany.
