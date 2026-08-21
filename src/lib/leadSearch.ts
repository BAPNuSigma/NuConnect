/**
 * Lead search: find candidate firms on the open web (no third-party lead database).
 * Discovery runs against Google's Programmable Search Engine (100 free queries/day) and/or
 * Brave's Search API (2,000 free queries/month) — whichever are configured — and merges the
 * results. Contact info is pulled by fetching each firm's own site and scanning it for
 * emails/phone numbers — no paid enrichment provider involved.
 */

const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

const FIRM_SUFFIXES = /\b(llc|llp|lp|pllc|pc|inc|incorporated|corp|corporation|co|company|group|partners|associates|ltd)\b/g;

/** Normalize a firm name for dedupe comparisons (strip legal suffixes/punctuation, lowercase). */
export function normalizeFirmName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[.,']/g, "")
    .replace(FIRM_SUFFIXES, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type LeadSearchInput = {
  discipline?: string;
  location?: string;
  firmType?: string;
};

export function buildLeadQuery({ discipline, location, firmType }: LeadSearchInput): string {
  const keywords = [firmType, discipline].filter(Boolean).join(" ").trim();
  const base = keywords ? `${keywords} firms` : "firms";
  return location ? `${base} in ${location}` : base;
}

export function isGoogleSearchConfigured(): boolean {
  return !!(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID);
}

export function isBraveSearchConfigured(): boolean {
  return !!process.env.BRAVE_API_KEY;
}

export function isLeadSearchConfigured(): boolean {
  return isGoogleSearchConfigured() || isBraveSearchConfigured();
}

const DEFAULT_BRAVE_MONTHLY_CAP = 900; // stays under the ~1,000 queries Brave's $5/month free credit covers

/** How many Brave queries we'll allow per calendar month before pausing Brave (app-level guard; Brave itself has no spend cap). */
export function braveMonthlyCap(): number {
  const raw = process.env.BRAVE_MONTHLY_QUERY_CAP;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BRAVE_MONTHLY_CAP;
}

export type LeadCandidate = {
  name: string;
  url: string;
  displayLink: string;
  snippet: string;
  source: "google" | "brave";
};

type ProviderResult = { ok: true; results: LeadCandidate[] } | { ok: false; error: string };

/** Search results often carry a "Title | Site Name" suffix; keep the part before it. */
function cleanTitle(title: string): string {
  return title.split(/\s[|–]\s|\s-\s/)[0].trim();
}

/** Collapse a URL to host+path so the same firm found by both providers dedupes to one row. */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

async function searchGoogle(query: string, count: number): Promise<ProviderResult> {
  const params = new URLSearchParams({
    key: process.env.GOOGLE_CSE_API_KEY!,
    cx: process.env.GOOGLE_CSE_ID!,
    q: query,
    num: String(Math.min(Math.max(count, 1), 10)), // Google CSE caps at 10 per request
  });

  let res: Response;
  try {
    res = await fetch(`${GOOGLE_CSE_ENDPOINT}?${params.toString()}`, { signal: AbortSignal.timeout(10000) });
  } catch {
    return { ok: false, error: "Couldn't reach Google's search API." };
  }

  const body = (await res.json().catch(() => null)) as {
    items?: { title?: string; link?: string; displayLink?: string; snippet?: string }[];
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    return { ok: false, error: `Google: ${body?.error?.message ?? `search failed (${res.status})`}` };
  }

  const results: LeadCandidate[] = (body?.items ?? [])
    .filter((item) => !!item.link)
    .map((item) => ({
      name: cleanTitle(item.title ?? item.displayLink ?? "Unknown"),
      url: item.link!,
      displayLink: item.displayLink ?? "",
      snippet: item.snippet ?? "",
      source: "google",
    }));

  return { ok: true, results };
}

async function searchBrave(query: string, count: number): Promise<ProviderResult> {
  const params = new URLSearchParams({ q: query, count: String(Math.min(Math.max(count, 1), 20)) });

  let res: Response;
  try {
    res = await fetch(`${BRAVE_ENDPOINT}?${params.toString()}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_API_KEY! },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { ok: false, error: "Couldn't reach Brave's search API." };
  }

  const body = (await res.json().catch(() => null)) as {
    web?: { results?: { title?: string; url?: string; description?: string }[] };
    message?: string;
  } | null;

  if (!res.ok) {
    return { ok: false, error: `Brave: ${body?.message ?? `search failed (${res.status})`}` };
  }

  const results: LeadCandidate[] = (body?.web?.results ?? [])
    .filter((item) => !!item.url)
    .map((item) => {
      let host = "";
      try {
        host = new URL(item.url!).hostname;
      } catch {
        // leave host blank if the URL is malformed
      }
      return {
        name: cleanTitle(item.title ?? host ?? "Unknown"),
        url: item.url!,
        displayLink: host,
        snippet: item.description ?? "",
        source: "brave",
      };
    });

  return { ok: true, results };
}

export async function searchBusinesses(
  input: LeadSearchInput,
  opts: { count?: number; useBrave?: boolean } = {}
): Promise<{ ok: true; query: string; results: LeadCandidate[] } | { ok: false; error: string }> {
  const count = opts.count ?? 10;
  const googleOn = isGoogleSearchConfigured();
  // useBrave defaults to true; the search route sets it false once the monthly budget is used up.
  const braveOn = isBraveSearchConfigured() && opts.useBrave !== false;
  if (!googleOn && !braveOn) {
    return {
      ok: false,
      error: isBraveSearchConfigured()
        ? "Brave's monthly search budget is used up for this cycle. It resumes next month, or raise BRAVE_MONTHLY_QUERY_CAP."
        : "Lead search isn't configured. Set GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID, and/or BRAVE_API_KEY.",
    };
  }

  const query = buildLeadQuery(input);
  const tasks: Promise<ProviderResult>[] = [];
  if (googleOn) tasks.push(searchGoogle(query, count));
  if (braveOn) tasks.push(searchBrave(query, count));
  const settled = await Promise.all(tasks);

  const seen = new Set<string>();
  const results: LeadCandidate[] = [];
  for (const outcome of settled) {
    if (!outcome.ok) continue;
    for (const candidate of outcome.results) {
      const key = normalizeUrl(candidate.url);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(candidate);
    }
  }

  if (results.length === 0) {
    const errors = settled.filter((o): o is { ok: false; error: string } => !o.ok).map((o) => o.error);
    if (errors.length > 0) return { ok: false, error: errors.join(" ") };
  }

  return { ok: true, query, results };
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|svg|webp)$/i;
const PLACEHOLDER_DOMAINS = ["example.com", "domain.com", "yourdomain.com", "email.com", "sentry.io", "wixpress.com"];

export type ContactInfo = { emails: string[]; phones: string[] };

function extractContactInfo(html: string): ContactInfo {
  const emails = new Set<string>();
  const mailtoRe = /mailto:([^"'?\s>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(html))) emails.add(m[1].toLowerCase());
  for (const raw of html.match(EMAIL_RE) ?? []) {
    const email = raw.toLowerCase();
    if (IMAGE_EXT_RE.test(email)) continue;
    if (PLACEHOLDER_DOMAINS.some((d) => email.endsWith(`@${d}`))) continue;
    emails.add(email);
  }
  const phones = new Set<string>();
  for (const phone of html.match(PHONE_RE) ?? []) phones.add(phone.trim());

  return { emails: Array.from(emails).slice(0, 5), phones: Array.from(phones).slice(0, 5) };
}

export async function fetchContactInfo(
  url: string
): Promise<{ ok: true } & ContactInfo | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NuConnectLeadSearch/1.0)" },
    });
  } catch {
    return { ok: false, error: "Couldn't reach that site." };
  }
  if (!res.ok) return { ok: false, error: `Site returned ${res.status}` };
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) {
    return { ok: false, error: "That page isn't HTML." };
  }
  const html = await res.text();
  return { ok: true, ...extractContactInfo(html) };
}
