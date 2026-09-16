import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Ensure a URL stored by a vendor (potentially without a scheme) is safe to
 * use in an <a href>.  Without a scheme the browser treats "example.com" as a
 * relative path and routes to an internal 404.
 *
 * Returns null for blank / falsy input so callers can guard with `&&`.
 */
export function ensureAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const t = url.trim();
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("//")) {
    return t;
  }
  return `https://${t}`;
}

/**
 * Normalise a URL before persisting it — prepend https:// if the user typed
 * a bare domain (e.g. "mysite.com").  Returns null for blank input.
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  return ensureAbsoluteUrl(url);
}
