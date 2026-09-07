import { parse } from "node-html-parser";
import type { Check } from "../types.js";
import { withTimeout } from "../http.js";
import { section } from "./util.js";

/** Returns the final HTTP status, or 0 for a network error / timeout. */
async function probe(url: string, userAgent: string, timeoutMs: number): Promise<number> {
  try {
    const head = await withTimeout(
      (signal) =>
        fetch(url, { method: "HEAD", redirect: "follow", signal, headers: { "user-agent": userAgent } }),
      timeoutMs,
    );
    if (head.status === 405 || head.status === 501) {
      const get = await withTimeout(
        (signal) =>
          fetch(url, {
            method: "GET",
            redirect: "follow",
            signal,
            headers: { "user-agent": userAgent, range: "bytes=0-0" },
          }),
        timeoutMs,
      );
      return get.status;
    }
    return head.status;
  } catch {
    return 0;
  }
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

export const links: Check = async (ctx) => {
  const s = section("links", "Internal links");

  if (!ctx.html) {
    s.skip("The final response was not HTML");
    return s.done();
  }

  const root = parse(ctx.html);
  const seen = new Set<string>();
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href || /^(mailto:|tel:|javascript:|#|data:)/i.test(href)) continue;
    let abs: URL;
    try {
      abs = new URL(href, ctx.finalUrl);
    } catch {
      continue;
    }
    if (abs.host !== ctx.finalUrl.host) continue;
    abs.hash = "";
    seen.add(abs.toString());
    if (seen.size >= ctx.options.maxLinks) break;
  }

  if (seen.size === 0) {
    s.add("info", "No internal links found on the homepage");
    return s.done();
  }

  const urls = [...seen];
  const statuses = await mapPool(urls, 6, (u) =>
    probe(u, ctx.options.userAgent, Math.min(ctx.options.timeoutMs, 10_000)),
  );

  const broken = urls
    .map((url, i) => ({ url, code: statuses[i] ?? 0 }))
    .filter((entry) => entry.code === 0 || entry.code >= 400);

  if (broken.length === 0) {
    s.add("pass", `Checked ${urls.length} internal link(s) — all reachable`);
  } else {
    s.add(
      "warning",
      `${broken.length} of ${urls.length} internal link(s) look broken`,
      broken.slice(0, 10).map((b) => `${b.code || "ERR"}  ${b.url}`).join("\n"),
    );
  }

  return s.done();
};
