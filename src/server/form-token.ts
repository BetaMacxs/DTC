import "server-only";
import { randomToken, safeEqual, sign } from "@/server/crypto";
import { appSecret } from "@/server/secret";

/**
 * A signed timestamp rendered into the checkout page. A real shopper spends
 * at least a few seconds on the form; a bot posting straight to the action
 * either has no token or submits too fast. Neither is told which.
 */

const MIN_FILL_MS = 2500;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function issueFormToken(now = Date.now()): Promise<string> {
  const stamp = String(now);
  // Each rendered checkout gets its own nonce so the token can also act as
  // an idempotency key when an order submission is retried.
  const nonce = randomToken(16);
  const payload = `checkout:${stamp}:${nonce}`;
  return `${stamp}.${nonce}.${sign(payload, await appSecret())}`;
}

export async function checkFormToken(token: unknown, now = Date.now()): Promise<boolean> {
  if (typeof token !== "string") return false;
  const [stamp, nonce, signature, extra] = token.split(".");
  if (extra !== undefined || !stamp || !nonce || !signature || !/^\d{10,16}$/.test(stamp)) return false;
  if (!/^[A-Za-z0-9_-]{20,32}$/.test(nonce)) return false;
  if (!safeEqual(sign(`checkout:${stamp}:${nonce}`, await appSecret()), signature)) return false;
  const age = now - Number(stamp);
  return age >= MIN_FILL_MS && age <= MAX_AGE_MS;
}
