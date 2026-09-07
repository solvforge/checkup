import type { Check } from "../types.js";
import { fetchFollow } from "../http.js";
import { section } from "./util.js";

export const connection: Check = async (ctx) => {
  const s = section("connection", "Connection & redirects");

  if (ctx.status === 200) {
    s.add("pass", "Homepage returns 200 OK");
  } else {
    s.add(ctx.status >= 500 ? "critical" : "warning", `Homepage returns HTTP ${ctx.status}`);
  }

  const hops = ctx.redirectChain.length - 1;
  if (hops > 0) {
    s.add(
      hops > 2 ? "warning" : "info",
      `${hops} redirect${hops > 1 ? "s" : ""} before the page loads`,
      ctx.redirectChain.map((h) => `${h.status}  ${h.url}`).join("\n"),
    );
  }

  // Plain HTTP should redirect to HTTPS.
  try {
    const httpUrl = `http://${ctx.input.host}${ctx.input.pathname}`;
    const r = await fetchFollow(httpUrl, {
      timeoutMs: ctx.options.timeoutMs,
      userAgent: ctx.options.userAgent,
    });
    if (r.finalUrl.startsWith("https://")) {
      s.add("pass", "HTTP redirects to HTTPS");
    } else {
      s.add("critical", "HTTP is served without an upgrade to HTTPS", `http://${ctx.input.host} stayed on plain HTTP`);
    }
  } catch {
    s.add("info", "Could not test plain-HTTP behaviour (port 80 may be closed)");
  }

  // www / apex should collapse to one canonical host.
  try {
    const bare = ctx.input.host.replace(/^www\./i, "");
    const other = ctx.input.host.toLowerCase().startsWith("www.") ? bare : `www.${bare}`;
    const r = await fetchFollow(`https://${other}/`, {
      timeoutMs: ctx.options.timeoutMs,
      userAgent: ctx.options.userAgent,
    });
    const otherFinalHost = new URL(r.finalUrl).host;
    if (otherFinalHost === ctx.finalUrl.host) {
      s.add("pass", `${other} redirects to the canonical host`);
    } else if (r.res.status === 200) {
      s.add(
        "warning",
        `${other} also serves the site without redirecting to one canonical host`,
        `Both ${ctx.finalUrl.host} and ${otherFinalHost} answer with 200 — this can split SEO signals`,
      );
    }
  } catch {
    // the other hostname may simply not resolve — nothing to report
  }

  return s.done();
};
