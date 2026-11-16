import "server-only";
import { headers } from "next/headers";
import { isIP } from "node:net";
import type { StoreSettings } from "@/lib/domain/settings";

/**
 * The address the store is being visited at. Used for absolute links: share
 * cards, the sitemap, and product links inside WhatsApp messages. An owner
 * can pin a canonical address in Settings; otherwise the request's own host
 * is used, which is right on localhost, a temporary Hostinger domain and the
 * final domain alike.
 */
export async function siteOrigin(settings: StoreSettings): Promise<string> {
  if (settings.store.siteUrl) return settings.store.siteUrl.replace(/\/+$/, "");
  const list = await headers();
  // Use the request Host header rather than visitor-supplied forwarded host or
  // protocol values. Vercel preserves the public host and serves production
  // traffic over HTTPS; localhost remains HTTP for development.
  const host = list.get("host")?.trim() || "localhost:3000";
  const validHost = /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::\d{1,5})?$/i.test(host);
  if (!validHost) return "https://localhost";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

/** Client address from headers set by the hosting proxy. The caller hashes it before persistence. */
export async function clientAddress(): Promise<string> {
  const list = await headers();
  const validIp = (raw: string | null | undefined): string | null => {
    const value = raw?.trim();
    if (!value || value.length > 64) return null;
    if (isIP(value)) return value;
    const bracketed = value.match(/^\[([^\]]+)\](?::\d+)?$/);
    if (bracketed && isIP(bracketed[1])) return bracketed[1];
    const ipv4WithPort = value.match(/^((?:\d{1,3}\.){3}\d{1,3}):\d+$/);
    if (ipv4WithPort && isIP(ipv4WithPort[1])) return ipv4WithPort[1];
    return null;
  };

  // Vercel and Cloudflare overwrite these platform-specific headers. For a
  // conventional reverse proxy, use the final forwarded hop (the proxy-added
  // address), never the visitor-controlled first entry.
  const vercel = validIp(list.get("x-vercel-forwarded-for")?.split(",")[0]);
  if (vercel) return vercel;
  const cloudflare = validIp(list.get("cf-connecting-ip"));
  if (cloudflare) return cloudflare;
  const forwarded = list.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  const proxyAdded = validIp(forwarded?.at(-1));
  return proxyAdded ?? "unknown";
}
