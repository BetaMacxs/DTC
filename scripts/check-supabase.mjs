#!/usr/bin/env node
/**
 * Checks a Supabase project's security from the outside — what a shopper,
 * and a signed-in stranger, can and cannot do — and that the store's data is
 * in place. It creates disposable probe records and removes them afterwards.
 *
 *   npm run db:check
 *
 * Reads SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY from
 * the environment or .env.local. Prefer a staging project for this check.
 */

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env, fail, loadEnv } from "./lib.mjs";

loadEnv();
const url = env("SUPABASE_URL")?.replace(/\/+$/, "");
const publishable = env("SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_ANON_KEY");
const secret = env("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !publishable || !secret) {
  fail("Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY first.");
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const shopper = createClient(url, publishable, options);
const service = createClient(url, secret, options);
const results = [];
const suffix = randomBytes(8).toString("hex");
const temporary = {
  productId: null,
  categoryIds: [],
  orderIds: [],
  storagePaths: [],
  userIds: [],
};

async function check(label, run) {
  try {
    const outcome = await run();
    results.push({ ok: outcome === true, label, detail: outcome === true ? "" : String(outcome) });
  } catch (error) {
    results.push({ ok: false, label, detail: error instanceof Error ? error.message : String(error) });
  }
}

/** A request that must be refused: an error, or no rows touched. */
const refused = async (request) => {
  const { data, error, count } = await request;
  if (error) return true;
  return (Array.isArray(data) && data.length > 0) || (count ?? 0) > 0 ? "allowed" : true;
};

async function cleanup(label, run) {
  try {
    const { error } = await run();
    if (error) results.push({ ok: false, label, detail: error.message });
  } catch (error) {
    results.push({ ok: false, label, detail: error instanceof Error ? error.message : String(error) });
  }
}

/* -------------------------------------------------------- disposable probes */

// A draft product gives the write-permission checks a safe target. Even if a
// policy is accidentally open, only this temporary record can be changed.
await check("create a disposable draft product for permission checks", async () => {
  const { data, error } = await service
    .from("products")
    .insert({
      slug: \`security-check-\${suffix}\`,
      name: "Security check product",
      status: "draft",
      variants: [{
        id: "security-check",
        optionValues: [],
        price: 1,
        compareAtPrice: null,
        sku: "SECURITY-CHECK",
        stock: 1,
        available: true,
        imageId: null,
      }],
    })
    .select("id")
    .single();
  if (error) return error.message;
  temporary.productId = data.id;
  return true;
});

let settingsData = null;
await check("the settings row exists", async () => {
  const { data, error } = await service.from("store_settings").select("data").eq("id", 1).maybeSingle();
  if (error) return error.message;
  if (!data) return "no settings row — apply the database migrations first";
  settingsData = data.data;
  return true;
});

let mediaBucketReady = false;
await check("the photo bucket exists and is public", async () => {
  const { data, error } = await service.storage.getBucket("store-media");
  if (error) return error.message;
  mediaBucketReady = Boolean(data.public);
  return mediaBucketReady ? true : "bucket is not public";
});

await check("at least one admin exists", async () => {
  const { count, error } = await service.from("admin_users").select("user_id", { count: "exact", head: true });
  return error ? error.message : (count ?? 0) > 0 ? true : "no admin yet — create the owner and grant admin access";
});

/* ----------------------------------------------------- what a shopper can do */

await check("shoppers can read the settings and published products", async () => {
  const settings = await shopper.from("store_settings").select("id");
  const products = await shopper.from("products").select("id, status");
  if (settings.error || products.error) return (settings.error ?? products.error).message;
  return products.data.every((product) => product.status !== "draft") ? true : "drafts are visible";
});

await check("shoppers can't read orders", () => refused(shopper.from("orders").select("id").limit(1)));
await check("shoppers can't see who the admins are", () => refused(shopper.from("admin_users").select("user_id").limit(1)));

await check("shoppers can't change products", () => {
  if (!temporary.productId) return "no disposable product was available for this check";
  return refused(
    shopper
      .from("products")
      .update({ name: "Changed by shopper" }, { count: "exact" })
      .eq("id", temporary.productId)
      .select("id"),
  );
});

await check("shoppers can't change settings", () => {
  if (settingsData === null) return "settings row was not available for this check";
  // Same-value update: if RLS is broken, no store configuration is overwritten.
  return refused(
    shopper
      .from("store_settings")
      .update({ data: settingsData }, { count: "exact" })
      .eq("id", 1)
      .select("id"),
  );
});

await check("shoppers can't add categories", async () => {
  const { data, error } = await shopper
    .from("categories")
    .insert({ slug: \`security-check-\${suffix}\`, name: "Security check" })
    .select("id")
    .maybeSingle();
  if (error) return true;
  if (data?.id) {
    temporary.categoryIds.push(data.id);
    return "allowed";
  }
  return "insert returned no row without an error";
});

await check("shoppers can't create orders directly", async () => {
  const { data, error } = await shopper
    .from("orders")
    .insert({
      channel: "web",
      status: "received",
      payment_method: "cod",
      currency: "ZAR",
      items: [{}],
      subtotal: 1,
      total: 1,
      customer: {},
      access_token_hash: randomBytes(32).toString("hex"),
    })
    .select("id")
    .maybeSingle();
  if (error) return true;
  if (data?.id) {
    temporary.orderIds.push(data.id);
    return "allowed";
  }
  return "insert returned no row without an error";
});

if (mediaBucketReady) {
  await check("shoppers can't upload photos", async () => {
    const path = \`security-check-\${suffix}.png\`;
    const { data, error } = await shopper.storage
      .from("store-media")
      .upload(path, new Uint8Array([1]), { contentType: "image/png" });
    if (error) return true;
    temporary.storagePaths.push(data.path ?? path);
    return "allowed";
  });
}

await check("shoppers can't make themselves admin", async () => {
  const email = \`security-check-anon-\${suffix}@example.com\`;
  const password = randomBytes(18).toString("base64url");
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) return created.error.message;
  temporary.userIds.push(created.data.user.id);
  const { error } = await shopper.rpc("grant_admin", { p_email: email });
  return error ? true : "allowed";
});

await check("public sign-ups are off", async () => {
  const email = \`security-check-signup-\${suffix}@example.com\`;
  const { data, error } = await shopper.auth.signUp({
    email,
    password: randomBytes(18).toString("base64url"),
  });
  if (data.user?.id) temporary.userIds.push(data.user.id);
  return error ? true : "anyone can create an account (turn off public sign-ups in Supabase Auth)";
});

/* ------------------------------------------- what a signed-in stranger can do */

const strangerEmail = \`security-check-stranger-\${suffix}@example.com\`;
const strangerPassword = randomBytes(18).toString("base64url");
const created = await service.auth.admin.createUser({
  email: strangerEmail,
  password: strangerPassword,
  email_confirm: true,
});

let stranger = null;
if (created.error) {
  results.push({ ok: false, label: "create a throwaway user for the signed-in checks", detail: created.error.message });
} else {
  temporary.userIds.push(created.data.user.id);
  stranger = createClient(url, publishable, options);
  const signedIn = await stranger.auth.signInWithPassword({ email: strangerEmail, password: strangerPassword });
  if (signedIn.error) {
    results.push({ ok: false, label: "sign in as the throwaway user", detail: signedIn.error.message });
  } else {
    await check("signed-in non-admins can't read orders", () =>
      refused(stranger.from("orders").select("id").limit(1)),
    );
    await check("signed-in non-admins can't change products", () => {
      if (!temporary.productId) return "no disposable product was available for this check";
      return refused(
        stranger
          .from("products")
          .update({ name: "Changed by non-admin" }, { count: "exact" })
          .eq("id", temporary.productId)
          .select("id"),
      );
    });
    await check("signed-in non-admins can't change settings", () => {
      if (settingsData === null) return "settings row was not available for this check";
      return refused(
        stranger
          .from("store_settings")
          .update({ data: settingsData }, { count: "exact" })
          .eq("id", 1)
          .select("id"),
      );
    });
    if (mediaBucketReady) {
      await check("signed-in non-admins can't upload photos", async () => {
        const path = \`security-check-stranger-\${suffix}.png\`;
        const { data, error } = await stranger.storage
          .from("store-media")
          .upload(path, new Uint8Array([1]), { contentType: "image/png" });
        if (error) return true;
        temporary.storagePaths.push(data.path ?? path);
        return "allowed";
      });
    }
    await check("signed-in non-admins are not admins", async () => {
      const { data, error } = await stranger.rpc("is_admin");
      return error ? error.message : data === false ? true : "is_admin() returned true";
    });
    await check("signed-in non-admins can't grant admin access", async () => {
      const { error } = await stranger.rpc("grant_admin", { p_email: strangerEmail });
      return error ? true : "allowed";
    });
  }
}

/* ----------------------------------------------------------- clean up probes */

for (const id of temporary.orderIds) {
  await cleanup("remove temporary order", () => service.from("orders").delete().eq("id", id));
}
for (const id of temporary.categoryIds) {
  await cleanup("remove temporary category", () => service.from("categories").delete().eq("id", id));
}
for (const path of temporary.storagePaths) {
  await cleanup("remove temporary upload", () => service.storage.from("store-media").remove([path]));
}
if (temporary.productId) {
  await cleanup("remove temporary product", () => service.from("products").delete().eq("id", temporary.productId));
}
for (const id of temporary.userIds) {
  await cleanup("remove temporary auth user", () => service.auth.admin.deleteUser(id));
}

/* ------------------------------------------------------------------- report */

for (const result of results) {
  console.log(\`\${result.ok ? "✓" : "✗"} \${result.label}\${result.detail ? \` — \${result.detail}\` : ""}\`);
}
const failed = results.filter((result) => !result.ok).length;
console.log(failed === 0 ? \`\nAll \${results.length} checks passed.\` : \`\n\${failed} of \${results.length} checks failed.\`);
process.exit(failed === 0 ? 0 : 1);
