/**
 * Fetch and parse JSON without throwing. Returns null on any failure.
 */
export async function fetchJsonSafe(url: string, options?: RequestInit): Promise<unknown> {
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, options);
    text = await res.text();
  } catch {
    return null;
  }
  if (!text || !text.trim()) return null;
  if (text.trimStart().startsWith("<")) return null; // HTML error page
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
