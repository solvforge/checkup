import type { Finding, Section, Severity } from "../types.js";

export interface SectionBuilder {
  add(severity: Severity, title: string, detail?: string): void;
  skip(reason: string): void;
  done(): Section;
}

export function section(key: string, label: string): SectionBuilder {
  const findings: Finding[] = [];
  let skipped: string | undefined;
  return {
    add(severity, title, detail) {
      findings.push({ severity, title, ...(detail ? { detail } : {}) });
    },
    skip(reason) {
      skipped = reason;
    },
    done() {
      return skipped ? { key, label, findings, skipped } : { key, label, findings };
    },
  };
}

export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
