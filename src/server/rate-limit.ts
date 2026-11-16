import "server-only";
import { backendKind, supabaseConfig } from "@/server/env";
import { serviceClient } from "@/server/backend/supabase/clients";
import { sha256, sign } from "@/server/crypto";

/**
 * Fixed-window rate limiter.
 *
 * Supabase-backed deployments must use the shared Postgres counter. If that
 * protection is unavailable, this throws rather than silently weakening
 * protection to per-instance memory (which is bypassable on serverless hosts).
 * In-memory limits are reserved for the explicitly local backend.
 */

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Shared rate limiting is unavailable.");
    this.name = "RateLimitUnavailableError";
  }
}

type Window = { count: number; resetAt: number };
const globalKey = Symbol.for("storefront.rateLimits");
const buckets: Map<string, Window> =
  ((globalThis as Record<symbol, unknown>)[globalKey] as Map<string, Window>) ?? new Map();
(globalThis as Record<symbol, unknown>)[globalKey] = buckets;

export function rateLimitInMemory(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [name, window] of buckets) if (window.resetAt <= now) buckets.delete(name);
  }
  const window = buckets.get(key);
  if (!window || window.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  window.count += 1;
  return window.count <= limit
    ? { ok: true, retryAfterMs: 0 }
    : { ok: false, retryAfterMs: window.resetAt - now };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterMs: number }> {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1) {
    throw new RangeError("Rate-limit limit and window must be positive integers.");
  }

  if (backendKind() !== "supabase") {
    return rateLimitInMemory(sha256(key), limit, windowMs);
  }

  if (key.endsWith(":unknown")) {
    console.error("[rate-limit] No trusted client address was available.");
    throw new RateLimitUnavailableError();
  }

  const config = supabaseConfig();
  if (!config?.secretKey) {
    console.error("[rate-limit] Supabase backend is missing its server secret key.");
    throw new RateLimitUnavailableError();
  }

  // A plain SHA-256 hash of an IP is reversible by enumerating the small IP
  // address space. Use a keyed HMAC so stored identifiers cannot be recovered
  // without the server-side secret.
  const storageKey = sign(key, config.secretKey);

  try {
    const { data, error } = await serviceClient(config).rpc("check_rate_limit", {
      p_key: storageKey,
      p_limit: limit,
      p_window_ms: windowMs,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row || typeof row.allowed !== "boolean") {
      console.error("[rate-limit] Shared Supabase rate-limit RPC failed:", error?.message ?? "Invalid RPC response");
      throw new RateLimitUnavailableError();
    }
    const retryAfterMs = Number(row.retry_after_ms ?? 0);
    if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
      console.error("[rate-limit] Shared Supabase rate-limit RPC returned an invalid retry interval.");
      throw new RateLimitUnavailableError();
    }
    return { ok: row.allowed, retryAfterMs };
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) throw error;
    console.error("[rate-limit] Shared Supabase rate-limit RPC threw an exception:", error);
    throw new RateLimitUnavailableError();
  }
}

