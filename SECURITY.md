# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Email **alexander.vonhohnhorst@elixio.io** with:

- what the issue is and where in the code it lives
- steps to reproduce, or a proof of concept
- what an attacker could achieve with it
- the version or commit you tested against

You will get an acknowledgement within **72 hours** and an assessment with a fix timeline within **7 days**.

AssetNode is maintained by a small team. We will tell you honestly where a fix sits in the queue rather than
leave you waiting in silence.

## Disclosure

We ask for **90 days** before public disclosure, or until a fix ships — whichever comes first. If we cannot fix
it in that window we will say so and agree a date with you rather than let it drift.

We are happy to credit you in the release notes and the commit. Tell us how you would like to be named, or say
if you would rather stay anonymous.

We do not currently run a paid bug bounty. We will not threaten legal action against anyone who reports a
vulnerability in good faith and follows this policy.

## Scope

In scope:

- the AssetNode application in this repository
- the hosted service at `app.asset-node.com` and `api.asset-node.com`

Out of scope:

- denial of service, volumetric or brute-force testing against the hosted service
- social engineering of Elixio UG staff or customers
- findings from automated scanners with no demonstrated impact
- missing hardening headers with no exploitable consequence
- vulnerabilities in third-party dependencies already covered by a published advisory — open a normal issue or
  let Renovate handle the bump

Please test against your own self-hosted instance where possible. If you need to test against the hosted
service, use your own account and do not access other tenants' data. If you encounter another organisation's
data, stop, do not save it, and tell us immediately.

## Supported versions

AssetNode is pre-1.0 and moves fast. Security fixes land on `main`. If you are self-hosting, track `main` or
the most recent release; older versions do not receive backported fixes.

## Handling of customer data

If a vulnerability exposes personal data of hosted-service customers, we treat it as a personal data breach
under Art. 33 GDPR and notify the competent supervisory authority within 72 hours where the threshold is met.
Please flag clearly in your report if you believe personal data was accessible.
