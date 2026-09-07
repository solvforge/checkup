import { resolveMx, resolveTxt, resolveCaa } from "node:dns/promises";
import type { Check } from "../types.js";
import { baseDomain, withTimeout } from "../http.js";
import { section } from "./util.js";

export const dns: Check = async (ctx) => {
  const s = section("dns", "DNS & email");
  const domain = baseDomain(ctx.finalUrl.host);

  let hasMx = false;
  try {
    const mx = await resolveMx(domain);
    hasMx = mx.length > 0;
    if (hasMx) s.add("pass", `${mx.length} MX record(s) — the domain accepts email`);
    else s.add("info", "No MX records — the domain does not receive email");
  } catch {
    s.add("info", "No MX records — the domain does not receive email");
  }

  // SPF
  try {
    const txt = (await resolveTxt(domain)).map((chunks) => chunks.join(""));
    const spf = txt.find((r) => /^v=spf1/i.test(r));
    if (!spf) {
      if (hasMx) s.add("warning", "No SPF record");
    } else if (/[?+]all\b/i.test(spf)) {
      s.add("warning", `SPF record ends weakly (${/[-~?+]all/i.exec(spf)?.[0]})`, "-all (fail) or ~all (softfail) is expected");
    } else {
      s.add("pass", "SPF record present");
    }
  } catch {
    if (hasMx) s.add("info", "Could not read TXT records for SPF");
  }

  // DMARC
  try {
    const dmarc = (await resolveTxt(`_dmarc.${domain}`))
      .map((chunks) => chunks.join(""))
      .find((r) => /^v=DMARC1/i.test(r));
    if (!dmarc) {
      if (hasMx) s.add("warning", "No DMARC record (_dmarc TXT)");
    } else if (/p=none/i.test(dmarc)) {
      s.add("info", "DMARC policy is p=none (monitoring only)");
    } else {
      s.add("pass", `DMARC policy set (${/p=\w+/i.exec(dmarc)?.[0]})`);
    }
  } catch {
    if (hasMx) s.add("warning", "No DMARC record (_dmarc TXT)");
  }

  // CAA
  try {
    const caa = await resolveCaa(domain);
    if (!caa || caa.length === 0) {
      s.add("info", "No CAA records — any certificate authority can issue for this domain");
    } else {
      s.add("pass", `${caa.length} CAA record(s) restrict certificate issuance`);
    }
  } catch {
    s.add("info", "No CAA records — any certificate authority can issue for this domain");
  }

  // DNSSEC — asked over DNS-over-HTTPS since node:dns cannot query DNSKEY.
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=DNSKEY`, {
          signal,
          headers: { accept: "application/dns-json" },
        }),
      ctx.options.timeoutMs,
    );
    const json = (await res.json()) as { Answer?: { type: number }[] };
    const signed = Array.isArray(json.Answer) && json.Answer.some((a) => a.type === 48);
    if (signed) s.add("pass", "DNSSEC is enabled (DNSKEY records published)");
    else s.add("info", "DNSSEC does not appear to be enabled");
  } catch {
    s.add("info", "Could not check DNSSEC");
  }

  return s.done();
};
