import type { Check } from "../types.js";
import { connection } from "./connection.js";
import { tlsCheck } from "./tls.js";
import { headers } from "./headers.js";
import { performance } from "./performance.js";
import { seo } from "./seo.js";
import { robots } from "./robots.js";
import { sitemap } from "./sitemap.js";
import { mixedContent } from "./mixed.js";
import { links } from "./links.js";
import { dns } from "./dns.js";

/** Ordered map of every check, keyed by the name used in --only / --skip. */
export const CHECKS: Record<string, Check> = {
  connection,
  tls: tlsCheck,
  headers,
  performance,
  seo,
  robots,
  sitemap,
  mixed: mixedContent,
  links,
  dns,
};

export const CHECK_KEYS = Object.keys(CHECKS);
