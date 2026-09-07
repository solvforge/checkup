export interface FetchResult {
  res: Response;
  finalUrl: string;
  chain: { url: string; status: number }[];
}

/** Run a fetch-like promise with an AbortController-backed timeout. */
export async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a URL, following redirects manually so the hop chain can be reported.
 */
export async function fetchFollow(
  url: string,
  opts: {
    method?: string;
    timeoutMs: number;
    maxRedirects?: number;
    userAgent: string;
  },
): Promise<FetchResult> {
  const maxRedirects = opts.maxRedirects ?? 10;
  const chain: { url: string; status: number }[] = [];
  let current = url;

  for (let i = 0; i <= maxRedirects; i++) {
    const res = await withTimeout(
      (signal) =>
        fetch(current, {
          method: opts.method ?? "GET",
          redirect: "manual",
          signal,
          headers: {
            "user-agent": opts.userAgent,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        }),
      opts.timeoutMs,
    );
    chain.push({ url: current, status: res.status });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      // free the socket before the next hop
      await res.arrayBuffer().catch(() => undefined);
      current = new URL(location, current).toString();
      continue;
    }
    return { res, finalUrl: current, chain };
  }

  throw new Error(`Exceeded ${maxRedirects} redirects starting from ${url}`);
}

/** Strip a leading "www." so DNS/email lookups target the registrable domain. */
export function baseDomain(host: string): string {
  return host.replace(/^www\./i, "");
}
