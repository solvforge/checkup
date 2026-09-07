export type Severity = "critical" | "warning" | "info" | "pass";

export interface Finding {
  severity: Severity;
  title: string;
  /** Optional supporting detail; newlines render as indented sub-lines. */
  detail?: string;
}

export interface Section {
  key: string;
  label: string;
  findings: Finding[];
  /** Set when the whole section could not run (network error, API down, …). */
  skipped?: string;
}

export interface Options {
  timeoutMs: number;
  psiKey: string | undefined;
  maxLinks: number;
  userAgent: string;
}

export interface Context {
  /** Normalised input URL (https:// enforced when no scheme was given). */
  input: URL;
  /** Final URL after following redirects from `input`. */
  finalUrl: URL;
  /** Redirect hops from `input` to `finalUrl` (includes the final request). */
  redirectChain: { url: string; status: number }[];
  /** Response headers of the final page. */
  headers: Headers;
  /** HTTP status of the final page. */
  status: number;
  /** HTML body of the final page (empty string when the response is not HTML). */
  html: string;
  options: Options;
}

export type Check = (ctx: Context) => Promise<Section>;

export interface Report {
  target: string;
  finalUrl: string;
  startedAt: string;
  durationMs: number;
  score: number;
  grade: string;
  counts: Record<Severity, number>;
  sections: Section[];
}
