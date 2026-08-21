/**
 * Lead search: find candidate firms on the open web (no third-party lead database).
 * Discovery uses the Google Programmable Search Engine (Custom Search JSON API), which
 * has a free tier (100 queries/day). Contact info is pulled by fetching each firm's own
 * site and scanning it for emails/phone numbers — no paid enrichment provider involved.
 */

const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

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

export function isLeadSearchConfigured(): boolean {
  return !!(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID);
}

export type LeadCandidate = {
  name: string;
  url: string;
  displayLink: string;
  snippet: string;
};

/** Search results often carry a "Title | Site Name" suffix; keep the part before it. */
function cleanTitle(title: string): string {
  return title.split(/\s[|–]\s|\s-\s/)[0].trim();
}

export async function searchBusinesses(
  input: LeadSearchInput,
  count = 10
): Promise<{ ok: true; query: string; results: LeadCandidate[] } | { ok: false; error: string }> {
  if (!isLeadSearchConfigured()) {
    return { ok: false, error: "Lead search isn't configured. Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID." };
  }
  const query = buildLeadQuery(input);
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
    return { ok: false, error: body?.error?.message ?? `Search failed (${res.status})` };
  }

  const results: LeadCandidate[] = (body?.items ?? [])
    .filter((item) => !!item.link)
    .map((item) => ({
      name: cleanTitle(item.title ?? item.displayLink ?? "Unknown"),
      url: item.link!,
      displayLink: item.displayLink ?? "",
      snippet: item.snippet ?? "",
    }));

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
