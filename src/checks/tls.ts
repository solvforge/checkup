import tls from "node:tls";
import type { Check } from "../types.js";
import { errMessage, section } from "./util.js";

interface CertInfo {
  valid_to: string;
  issuer?: { O?: string; CN?: string };
}

function peerCert(host: string, timeoutMs: number): Promise<CertInfo> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, ALPNProtocols: ["h2", "http/1.1"] },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || Object.keys(cert).length === 0) reject(new Error("no certificate presented"));
        else resolve(cert as unknown as CertInfo);
      },
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error("connection timed out"));
    });
    socket.on("error", reject);
  });
}

export const tlsCheck: Check = async (ctx) => {
  const s = section("tls", "TLS certificate");

  if (ctx.finalUrl.protocol !== "https:") {
    s.add("critical", "The site is not served over HTTPS");
    return s.done();
  }

  try {
    const cert = await peerCert(ctx.finalUrl.host, ctx.options.timeoutMs);
    const daysLeft = Math.round((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000);
    const issuer = cert.issuer?.O ?? cert.issuer?.CN ?? "unknown CA";

    if (daysLeft < 0) {
      s.add("critical", "TLS certificate has expired", `Expired ${-daysLeft} day(s) ago`);
    } else if (daysLeft < 14) {
      s.add("critical", `TLS certificate expires in ${daysLeft} day(s)`, "Auto-renewal should already have run");
    } else if (daysLeft < 30) {
      s.add("warning", `TLS certificate expires in ${daysLeft} day(s)`, `Issued by ${issuer}`);
    } else {
      s.add("pass", `TLS certificate valid for ${daysLeft} more day(s)`, `Issued by ${issuer}`);
    }
  } catch (e) {
    s.skip(`Could not inspect the certificate (${errMessage(e)})`);
  }

  return s.done();
};
