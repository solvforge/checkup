import { colors } from "./colors.js";
import type { Report, Severity } from "./types.js";

export function renderJson(report: Report): string {
  return JSON.stringify(report, null, 2) + "\n";
}

export function renderHuman(report: Report): string {
  const c = colors();
  const mark: Record<Severity, string> = {
    critical: c.red("✗"),
    warning: c.yellow("▲"),
    info: c.blue("i"),
    pass: c.green("✓"),
  };

  const gradeColor =
    report.score >= 90 ? c.green : report.score >= 70 ? c.yellow : c.red;

  const out: string[] = [""];
  out.push(`  ${c.bold(report.finalUrl)}`);
  out.push(
    `  ${gradeColor(c.bold(`${report.grade}  ${report.score}/100`))}   ` +
      `${c.red(`${report.counts.critical} critical`)}   ` +
      `${c.yellow(`${report.counts.warning} warnings`)}   ` +
      `${c.dim(`${report.counts.info} notes`)}   ` +
      `${c.green(`${report.counts.pass} passed`)}`,
  );
  out.push("");

  for (const section of report.sections) {
    out.push(`  ${c.bold(c.underline(section.label))}`);
    if (section.skipped) {
      out.push(`    ${c.dim(`— skipped: ${section.skipped}`)}`);
      out.push("");
      continue;
    }
    if (section.findings.length === 0) {
      out.push(`    ${c.dim("— nothing to report")}`);
      out.push("");
      continue;
    }
    for (const finding of section.findings) {
      const title = finding.severity === "pass" ? c.dim(finding.title) : finding.title;
      out.push(`    ${mark[finding.severity]} ${title}`);
      if (finding.detail) {
        for (const line of finding.detail.split("\n")) {
          out.push(`       ${c.dim(line)}`);
        }
      }
    }
    out.push("");
  }

  out.push(`  ${c.dim(`Finished in ${(report.durationMs / 1000).toFixed(1)}s.`)}`);
  out.push("");
  out.push(
    `  ${c.cyan("Want these sorted?")} SolvForge builds and looks after websites,`,
  );
  out.push(`  hosting, performance and security. ${c.dim("→ https://www.solvforge.com")}`);
  out.push("");

  return out.join("\n") + "\n";
}
