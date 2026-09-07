import type { Check } from "../types.js";
import { withTimeout } from "../http.js";
import { errMessage, section } from "./util.js";

async function getText(
  url: string,
  userAgent: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await withTimeout(
    (signal) => fetch(url, { signal, headers: { "user-agent": userAgent } }),
    timeoutMs,
  );
  return { ok: res.ok, status: res.status, body: res.ok ? await res.text() : "" };
}

export const sitemap: Check = async (ctx) => {
  const s = section("sitemap", "XML sitemap");
  const { userAgent, timeoutMs } = ctx.options;

  // Prefer the URL declared in robots.txt, fall back to /sitemap.xml.
  let sitemapUrl = new URL("/sitemap.xml", ctx.finalUrl.origin).toString();
  try {
    const robots = await getText(
      new URL("/robots.txt", ctx.finalUrl.origin).toString(),
      userAgent,
      timeoutMs,
    );
    const declared = /^\s*sitemap:\s*(\S+)/im.exec(robots.body)?.[1];
    if (declared) sitemapUrl = new URL(declared, ctx.finalUrl.origin).toString();
  } catch {
    // fall back to the default location
  }

  let body: string;
  try {
    const res = await getText(sitemapUrl, userAgent, timeoutMs);
    if (!res.ok) {
      s.add("warning", `No sitemap at ${sitemapUrl} (HTTP ${res.status})`);
      return s.done();
    }
    body = res.body;
  } catch (e) {
    s.skip(`Could not fetch the sitemap (${errMessage(e)})`);
    return s.done();
  }

  const locCount = (body.match(/<loc>/gi) ?? []).length;
  if (/<sitemapindex[\s>]/i.test(body)) {
    s.add("pass", `Sitemap index listing ${locCount} child sitemap(s)`, sitemapUrl);
  } else if (/<urlset[\s>]/i.test(body)) {
    if (locCount === 0) s.add("warning", "Sitemap has no <url> entries", sitemapUrl);
    else s.add("pass", `Sitemap lists ${locCount} URL(s)`, sitemapUrl);
  } else {
    s.add("warning", "Sitemap does not look like valid XML", sitemapUrl);
  }

  return s.done();
};
