import { parse } from "node-html-parser";
import type { Check, Severity } from "../types.js";
import { section } from "./util.js";

// [selector, attribute, severity when loaded over http://]
const TARGETS: ReadonlyArray<readonly [string, string, Severity]> = [
  ["script[src]", "src", "critical"],
  ['link[rel="stylesheet"]', "href", "critical"],
  ["img[src]", "src", "warning"],
  ["iframe[src]", "src", "warning"],
  ["source[src]", "src", "warning"],
  ["video[src]", "src", "warning"],
  ["audio[src]", "src", "warning"],
  ["object[data]", "data", "warning"],
  ["form[action]", "action", "warning"],
];

export const mixedContent: Check = async (ctx) => {
  const s = section("mixed", "Mixed content");

  if (ctx.finalUrl.protocol !== "https:") {
    s.skip("The page is not served over HTTPS");
    return s.done();
  }
  if (!ctx.html) {
    s.skip("The final response was not HTML");
    return s.done();
  }

  const root = parse(ctx.html);
  const offenders: { url: string; severity: Severity }[] = [];

  for (const [selector, attr, severity] of TARGETS) {
    for (const el of root.querySelectorAll(selector)) {
      const value = el.getAttribute(attr);
      if (value && /^http:\/\//i.test(value)) offenders.push({ url: value, severity });
    }
  }

  if (offenders.length === 0) {
    s.add("pass", "No insecure (http://) resources on the page");
    return s.done();
  }

  const worst: Severity = offenders.some((o) => o.severity === "critical") ? "critical" : "warning";
  s.add(
    worst,
    `${offenders.length} resource(s) loaded over plain HTTP`,
    offenders.slice(0, 8).map((o) => o.url).join("\n"),
  );

  return s.done();
};
