# solvforge-checkup

[![CI](https://github.com/solvforge/checkup/actions/workflows/ci.yml/badge.svg)](https://github.com/solvforge/checkup/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/solvforge-checkup.svg)](https://www.npmjs.com/package/solvforge-checkup)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A one-command website health check. Point it at a URL and get a scored report
covering the things that actually break sites and cost conversions —
**performance, security, hosting/DNS, and SEO** — in about 30 seconds, with
nothing to install and no account to create.

```
npx solvforge-checkup example.com
```

## Why

Most "site audits" are either a 60-tab Lighthouse report you'll never read, or a
lead-magnet form. This is neither. It runs a focused set of checks, tells you
what's wrong in plain language, sorts it by severity, and gets out of the way.
It's also CI-friendly — exit code `1` when something critical is found.

## Sample

```
  https://www.example.com/
  B  85/100   0 critical   3 warnings   7 notes   15 passed

  Connection & redirects
    ✓ Homepage returns 200 OK
    ✓ HTTP redirects to HTTPS
    ✓ example.com redirects to the canonical host

  Security headers
    ✓ Strict-Transport-Security is set
    ▲ No Content-Security-Policy header
    ▲ Missing X-Content-Type-Options: nosniff
    ▲ No clickjacking protection (X-Frame-Options or CSP frame-ancestors)
    i No Referrer-Policy header

  XML sitemap
    ✓ Sitemap lists 60 URL(s)

  … (trimmed)
```

## Usage

```bash
# full report
npx solvforge-checkup https://example.com

# just the security-related checks
npx solvforge-checkup example.com --only headers,tls,mixed

# machine-readable, e.g. in a pipeline
npx solvforge-checkup example.com --json > report.json
```

### Options

| Flag | Description |
| --- | --- |
| `--json` | Output the full result as JSON instead of a report |
| `--only <a,b>` | Run only these checks |
| `--skip <a,b>` | Run everything except these checks |
| `--psi-key <key>` | Google PageSpeed Insights API key (skips the anonymous rate limit) |
| `--timeout <ms>` | Per-request timeout (default `15000`) |
| `--max-links <n>` | Internal links to test for the broken-link check (default `25`) |
| `--no-color` | Disable coloured output (also respects `NO_COLOR`) |
| `-h, --help` | Help |
| `-v, --version` | Version |

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | No critical issues |
| `1` | At least one critical issue — fail the build |
| `2` | The target could not be reached, or bad arguments |

## What it checks

| Check | Looks at |
| --- | --- |
| `connection` | Final status, redirect chain length, HTTP→HTTPS upgrade, `www`/apex canonicalisation |
| `tls` | Certificate expiry and issuer |
| `headers` | HSTS, CSP, `X-Content-Type-Options`, clickjacking protection, `Referrer-Policy`, `Permissions-Policy`, version disclosure |
| `performance` | Lighthouse score, LCP, CLS, TBT, page weight, TTFB, and real-user (CrUX) data — via the public PageSpeed Insights API |
| `seo` | `<title>`, meta description, canonical, `lang`, viewport, `<h1>` count, Open Graph basics |
| `robots` | `robots.txt` exists, doesn't blanket-block crawlers, references a sitemap |
| `sitemap` | `sitemap.xml` (or the one named in `robots.txt`) resolves and is valid XML with entries |
| `mixed` | Insecure `http://` scripts, styles, images, frames on an HTTPS page |
| `links` | HEADs a sample of internal links and flags 4xx/5xx/unreachable |
| `dns` | MX, SPF, DMARC, CAA, and DNSSEC |

## How it works

It makes one request for the page and shares that response with every check, then
runs the rest concurrently. The only external service it calls is Google's
**PageSpeed Insights API** (anonymous, rate-limited — pass `--psi-key` for
headroom) and a **DNS-over-HTTPS** lookup for DNSSEC. No browser, no Puppeteer,
two small dependencies.

Requires **Node 18.17+**.

## Contributing

Issues and PRs welcome. `npm run typecheck && npm run lint && npm run build`
should pass; add new checks under `src/checks/` and register them in
`src/checks/index.ts`.

---

Built and maintained by **[SolvForge](https://www.solvforge.com)** — we build,
host, secure and speed up websites for a living. If `checkup` turns up a list you
don't want to work through yourself, [that's what we do](https://www.solvforge.com).
