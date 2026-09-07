#!/usr/bin/env node
import { parseArgs } from "node:util";
import { CHECKS, CHECK_KEYS } from "./checks/index.js";
import { colors, configureColor } from "./colors.js";
import { fetchFollow } from "./http.js";
import { renderHuman, renderJson } from "./render.js";
import { summarise } from "./score.js";
import type { Context, Options, Report, Section } from "./types.js";
import { USER_AGENT, VERSION } from "./version.js";

const HELP = `
solvforge-checkup ${VERSION}
One-command website health check — performance, security, hosting and SEO.

USAGE
  npx solvforge-checkup <url> [options]

OPTIONS
  --json             Output machine-readable JSON instead of a report
  --only <a,b>       Run only these checks
  --skip <a,b>       Run everything except these checks
  --psi-key <key>    Google PageSpeed Insights API key (avoids rate limits)
  --timeout <ms>     Per-request timeout (default: 15000)
  --max-links <n>    Number of internal links to test (default: 25)
  --no-color         Disable coloured output
  -h, --help         Show this help
  -v, --version      Print the version

CHECKS
  ${CHECK_KEYS.join(", ")}

EXIT CODE
  0  no critical issues
  1  at least one critical issue (useful in CI)
  2  the target could not be reached / bad arguments

Built by SolvForge — https://www.solvforge.com
`;

function fail(message: string): never {
  process.stderr.write(`${colors().red("error:")} ${message}\n`);
  process.exit(2);
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: "boolean", default: false },
      only: { type: "string" },
      skip: { type: "string" },
      "psi-key": { type: "string" },
      timeout: { type: "string" },
      "max-links": { type: "string" },
      "no-color": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  configureColor(values["no-color"] ? false : undefined);

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  const rawTarget = positionals[0];
  if (!rawTarget) {
    process.stderr.write(HELP);
    fail("a URL is required");
  }

  let input: URL;
  try {
    input = new URL(/^https?:\/\//i.test(rawTarget) ? rawTarget : `https://${rawTarget}`);
  } catch {
    fail(`"${rawTarget}" is not a valid URL`);
  }

  const options: Options = {
    timeoutMs: Number(values.timeout) > 0 ? Number(values.timeout) : 15_000,
    psiKey: values["psi-key"],
    maxLinks: Number(values["max-links"]) > 0 ? Number(values["max-links"]) : 25,
    userAgent: USER_AGENT,
  };

  let selected = CHECK_KEYS;
  if (values.only) {
    const want = new Set(values.only.split(",").map((s) => s.trim()));
    selected = CHECK_KEYS.filter((k) => want.has(k));
  }
  if (values.skip) {
    const drop = new Set(values.skip.split(",").map((s) => s.trim()));
    selected = selected.filter((k) => !drop.has(k));
  }
  if (selected.length === 0) fail("no checks selected");

  const startedAt = Date.now();

  let base: Pick<Context, "finalUrl" | "redirectChain" | "headers" | "status" | "html">;
  try {
    const { res, finalUrl, chain } = await fetchFollow(input.toString(), {
      timeoutMs: options.timeoutMs,
      userAgent: options.userAgent,
    });
    const contentType = res.headers.get("content-type") ?? "";
    base = {
      finalUrl: new URL(finalUrl),
      redirectChain: chain,
      headers: res.headers,
      status: res.status,
      html: /html/i.test(contentType) ? await res.text() : "",
    };
  } catch (e) {
    fail(`could not reach ${input.host} — ${e instanceof Error ? e.message : String(e)}`);
  }

  const ctx: Context = { input, options, ...base };

  if (!values.json) {
    process.stderr.write(
      `${colors().dim(`Running ${selected.length} checks against ${ctx.finalUrl.origin} …`)}\n`,
    );
  }

  const results = await Promise.all(
    selected.map(async (key): Promise<Section> => {
      try {
        return await CHECKS[key]!(ctx);
      } catch (e) {
        return {
          key,
          label: key,
          findings: [],
          skipped: `check crashed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }),
  );

  const report: Report = {
    target: input.toString(),
    finalUrl: ctx.finalUrl.toString(),
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    ...summarise(results),
    sections: results,
  };

  process.stdout.write(values.json ? renderJson(report) : renderHuman(report));
  return report.counts.critical > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(`${e instanceof Error ? e.stack : String(e)}\n`);
    process.exit(2);
  });
