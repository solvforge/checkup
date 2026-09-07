import type { Check } from "../types.js";
import { withTimeout } from "../http.js";
import { errMessage, section } from "./util.js";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface PsiAudit {
  numericValue?: number;
}
interface PsiResponse {
  lighthouseResult?: {
    categories?: { performance?: { score?: number } };
    audits?: Record<string, PsiAudit>;
  };
  loadingExperience?: {
    overall_category?: string;
    metrics?: Record<string, { category?: string }>;
  };
}

export const performance: Check = async (ctx) => {
  const s = section("performance", "Performance (PageSpeed Insights)");

  const url = new URL(PSI_ENDPOINT);
  url.searchParams.set("url", ctx.finalUrl.toString());
  url.searchParams.set("strategy", "mobile");
  for (const category of ["performance", "seo", "best-practices"]) {
    url.searchParams.append("category", category);
  }
  if (ctx.options.psiKey) url.searchParams.set("key", ctx.options.psiKey);

  let data: PsiResponse;
  try {
    const res = await withTimeout(
      (signal) => fetch(url, { signal, headers: { "user-agent": ctx.options.userAgent } }),
      Math.max(ctx.options.timeoutMs, 60_000),
    );
    if (!res.ok) {
      const hint = res.status === 429 ? " — rate limited, pass --psi-key" : "";
      s.skip(`PageSpeed Insights API returned HTTP ${res.status}${hint}`);
      return s.done();
    }
    data = (await res.json()) as PsiResponse;
  } catch (e) {
    s.skip(`PageSpeed Insights API unreachable (${errMessage(e)})`);
    return s.done();
  }

  const lh = data.lighthouseResult;
  if (!lh) {
    s.skip("PageSpeed Insights returned no Lighthouse result");
    return s.done();
  }

  const perf = Math.round((lh.categories?.performance?.score ?? 0) * 100);
  if (perf < 50) s.add("critical", `Lighthouse performance score: ${perf}/100`);
  else if (perf < 90) s.add("warning", `Lighthouse performance score: ${perf}/100`);
  else s.add("pass", `Lighthouse performance score: ${perf}/100`);

  const audits = lh.audits ?? {};

  const lcp = audits["largest-contentful-paint"]?.numericValue;
  if (lcp != null) {
    const label = `Largest Contentful Paint: ${(lcp / 1000).toFixed(1)}s`;
    if (lcp > 4000) s.add("critical", label, "Good is under 2.5s");
    else if (lcp > 2500) s.add("warning", label, "Good is under 2.5s");
    else s.add("pass", label);
  }

  const cls = audits["cumulative-layout-shift"]?.numericValue;
  if (cls != null) {
    const label = `Cumulative Layout Shift: ${cls.toFixed(3)}`;
    if (cls > 0.25) s.add("critical", label, "Good is under 0.1");
    else if (cls > 0.1) s.add("warning", label, "Good is under 0.1");
    else s.add("pass", label);
  }

  const tbt = audits["total-blocking-time"]?.numericValue;
  if (tbt != null) {
    const label = `Total Blocking Time: ${Math.round(tbt)}ms`;
    if (tbt > 600) s.add("warning", label, "A lab proxy for INP; good is under 200ms");
    else s.add("pass", label);
  }

  const weight = audits["total-byte-weight"]?.numericValue;
  if (weight != null) {
    const mb = (weight / 1024 / 1024).toFixed(1);
    if (weight > 5 * 1024 * 1024) s.add("critical", `Page weight: ${mb} MB`);
    else if (weight > 3 * 1024 * 1024) s.add("warning", `Page weight: ${mb} MB`);
    else s.add("pass", `Page weight: ${mb} MB`);
  }

  const ttfb = audits["server-response-time"]?.numericValue;
  if (ttfb != null && ttfb > 600) {
    s.add("warning", `Server response time (TTFB): ${Math.round(ttfb)}ms`, "Good is under 200ms");
  }

  const fieldMetrics = data.loadingExperience?.metrics;
  if (fieldMetrics) {
    const names: Record<string, string> = {
      LARGEST_CONTENTFUL_PAINT_MS: "LCP",
      INTERACTION_TO_NEXT_PAINT: "INP",
      CUMULATIVE_LAYOUT_SHIFT_SCORE: "CLS",
    };
    const poor = Object.entries(names)
      .filter(([key]) => fieldMetrics[key]?.category === "SLOW")
      .map(([, label]) => label);
    if (poor.length) {
      s.add("warning", `Real-user data (Chrome UX Report) rates ${poor.join(", ")} as poor`);
    } else if (data.loadingExperience?.overall_category === "FAST") {
      s.add("pass", "Real-user data (Chrome UX Report) is good overall");
    }
  }

  return s.done();
};
