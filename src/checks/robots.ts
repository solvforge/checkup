import type { Check } from "../types.js";
import { withTimeout } from "../http.js";
import { errMessage, section } from "./util.js";

export const robots: Check = async (ctx) => {
  const s = section("robots", "robots.txt");
  const url = new URL("/robots.txt", ctx.finalUrl.origin);

  let body: string;
  try {
    const res = await withTimeout(
      (signal) => fetch(url, { signal, headers: { "user-agent": ctx.options.userAgent } }),
      ctx.options.timeoutMs,
    );
    if (res.status === 404) {
      s.add("info", "No robots.txt — crawlers assume everything is allowed");
      return s.done();
    }
    if (!res.ok) {
      s.add("warning", `robots.txt returned HTTP ${res.status}`);
      return s.done();
    }
    body = await res.text();
  } catch (e) {
    s.skip(`Could not fetch robots.txt (${errMessage(e)})`);
    return s.done();
  }

  const lines = body
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);

  let underStar = false;
  let blocksEverything = false;
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") underStar = value === "*";
    else if (key === "disallow" && underStar && value === "/") blocksEverything = true;
  }

  if (blocksEverything) {
    s.add(
      "critical",
      "robots.txt blocks every crawler (Disallow: / for User-agent: *)",
      "This de-indexes the whole site — usually left over from staging",
    );
  } else {
    s.add("pass", "robots.txt does not block the whole site");
  }

  if (/^\s*sitemap:/im.test(body)) s.add("pass", "robots.txt points to a sitemap");
  else s.add("info", "robots.txt does not reference a sitemap");

  return s.done();
};
