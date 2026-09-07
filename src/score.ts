import type { Report, Section, Severity } from "./types.js";

const PENALTY: Record<Severity, number> = {
  critical: 15,
  warning: 5,
  info: 0,
  pass: 0,
};

/** No single section can cost more than this, so one bad area can't tank the score alone. */
const SECTION_CAP = 30;

export function summarise(
  sections: Section[],
): Pick<Report, "score" | "grade" | "counts"> {
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0, pass: 0 };
  let penalty = 0;

  for (const section of sections) {
    if (section.skipped) continue;
    let sectionPenalty = 0;
    for (const finding of section.findings) {
      counts[finding.severity] += 1;
      sectionPenalty += PENALTY[finding.severity];
    }
    penalty += Math.min(SECTION_CAP, sectionPenalty);
  }

  const score = Math.max(0, 100 - penalty);
  const grade =
    score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  return { score, grade, counts };
}
