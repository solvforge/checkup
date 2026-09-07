import type { Check } from "../types.js";
import { section } from "./util.js";

const SIX_MONTHS = 15_552_000;

export const headers: Check = async (ctx) => {
  const s = section("headers", "Security headers");
  const h = ctx.headers;
  const csp = h.get("content-security-policy") ?? "";

  const hsts = h.get("strict-transport-security");
  if (!hsts) {
    s.add("warning", "No Strict-Transport-Security header");
  } else {
    const maxAge = Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? "0");
    if (maxAge < SIX_MONTHS) {
      s.add("info", `HSTS max-age is short (${maxAge}s)`, "Six months (15552000) or more is recommended");
    } else {
      s.add("pass", "Strict-Transport-Security is set");
    }
  }

  if (!csp) s.add("warning", "No Content-Security-Policy header");
  else s.add("pass", "Content-Security-Policy is set");

  if ((h.get("x-content-type-options") ?? "").toLowerCase() !== "nosniff") {
    s.add("warning", "Missing X-Content-Type-Options: nosniff");
  } else {
    s.add("pass", "X-Content-Type-Options: nosniff");
  }

  const xfo = h.get("x-frame-options");
  if (!xfo && !/frame-ancestors/i.test(csp)) {
    s.add("warning", "No clickjacking protection (X-Frame-Options or CSP frame-ancestors)");
  } else {
    s.add("pass", "Clickjacking protection present");
  }

  if (!h.get("referrer-policy")) s.add("info", "No Referrer-Policy header");
  else s.add("pass", "Referrer-Policy is set");

  if (!h.get("permissions-policy")) s.add("info", "No Permissions-Policy header");

  const server = h.get("server") ?? "";
  if (/\d+\.\d+/.test(server)) {
    s.add("warning", `Server header leaks a version number: "${server}"`);
  }
  const poweredBy = h.get("x-powered-by");
  if (poweredBy) {
    s.add("warning", `X-Powered-By header leaks stack details: "${poweredBy}"`);
  }

  return s.done();
};
