# Halden — e-commerce starter

A complete small-business shop you can make your own: a fast storefront, a real admin dashboard, and checkout by **WhatsApp**, **cash on delivery** or **bank transfer** — for any kind of product. Next.js 16, React 19, Tailwind CSS 4 and Supabase.

Everything an owner changes day to day — products, photos, categories, prices, stock, delivery options, payment methods, the WhatsApp number, colours, fonts and the homepage — is edited in the dashboard. No code changes, no redeploys.

It opens as **Halden**, a fictional demo store with 30 products, so you can try everything before adding your own. One click removes the demo.

---

## Deploy to Vercel

The production deployment uses GitHub, Vercel and Supabase. You do not need to run the application on your own computer.

1. **Connect GitHub to Vercel.** In Vercel, import the `BetaMacxs/DTC` repository and select the branch you want to deploy.
2. **Set the project configuration.** Vercel should detect Next.js automatically. Keep the build command as `npm run build` and the output settings at their defaults.
3. **Add server environment variables** in Vercel → Project → Settings → Environment Variables:

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable API key |
   | `SUPABASE_SECRET_KEY` | Your Supabase secret API key (server-only) |
   | `SESSION_SECRET` | A securely generated random value of at least 32 characters |

   Do not expose the Supabase secret key or session secret through a `NEXT_PUBLIC_` variable, commit them to GitHub, or paste them into source files.

4. **Disable public account registration.** In Supabase → Authentication → Sign In / Providers, turn off **Allow new users to sign up**. Customers do not need accounts; only accounts you create should be able to access the dashboard.
5. **Prepare the Supabase database.** Apply every file in `supabase/migrations/` in chronological filename order, once per migration, using the Supabase SQL Editor or the repository's migration workflow. Do not paste multiple migration files together as one SQL statement. Never run migrations against a production database until the changes have been reviewed and a backup/rollback plan is in place.
6. **Initialize the Detail Corner defaults.** If you used `npm run setup`, this is done automatically when the settings row is blank. Otherwise, from the connected hosted development environment run `npm run db:seed -- --detail-corner-if-blank`. This sets the store name and ZAR currency without overwriting existing settings. If you do not have a script runner, set these values in the dashboard after creating the admin.
7. **Create the first admin account.** In Supabase → Authentication → Users, add an owner user and confirm the email. Then run `select public.grant_admin('you@example.com');` in the SQL Editor, using that same email address.
8. **Deploy.** Deploy the project from Vercel. Review the build result and Vercel runtime logs before treating the deployment as ready.
9. **Configure the store.** Sign in to `/admin`, review the store settings, and set the canonical shop URL. Add your real business contact details, products, prices, delivery methods, policies and payment instructions before accepting orders.

Keep a separate Supabase staging project for testing database changes, checkout and inventory behaviour. Do not run demo seed or end-to-end test workflows against production data.

---

## What you get

**The shop**

- A homepage built from sections you arrange: a headline with photo, a store directory of categories, product rows (featured, newest, on sale, or any collection), banners, collection cards, and a delivery-and-payment strip that always matches your settings.
- Categories, hand-picked collections, search, filters that only offer choices that exist, and sorting.
- Product pages with variants (size, colour with swatches, capacity…), per-variant prices, stock and photos, a hover magnifier and swipeable photos on phones.
- A bag that remembers itself, checks live prices and stock, and shows how far the shopper is from free delivery.
- Checkout in three clear steps, and an order page the shopper can come back to through a private link.
- English, French, Spanish and Arabic. Arabic switches the whole shop to right-to-left.
- Works from a 320 px phone to a wide desktop, with the keyboard, and with screen readers.

**The dashboard** (`/admin`)

- **Overview** — what needs doing today: orders to confirm, WhatsApp handoffs to check, orders to send, products low on stock. Sales of the last 30 days count only orders you confirmed.
- **Orders** — every order with its customer, items, delivery and payment. Move it from received → confirmed → fulfilled → completed (or cancel it), mark it paid, keep notes. Stock follows by itself.
- **Products** — create, edit, duplicate, archive or delete; up to 12 photos each (resized in the browser before upload), options and variants, stock, compare-at prices, search-engine fields.
- **Categories and Collections** — create, edit, hide and reorder; pick a collection's products from any category.
- **Storefront** — accent colour (with automatic contrast), three type pairings, corner style, the announcement bar, the homepage headline and photo, and the homepage sections.
- **Settings** — store name, logo, language, currency, contact details and WhatsApp number, checkout methods and bank details, delivery options and free-delivery amount, policy pages, social links, demo content, password.

**Behind it**

- **Supabase** (Postgres, Auth, Storage, row-level security) for a live store — or a **local** file store that needs no account at all, for trying things out.
- Business rules — prices, stock, the order lifecycle, validation — live in one place (`src/lib/domain`) with unit tests; the database rules are tested on a real Postgres engine.

---

## Your admin account

For a Vercel-hosted Supabase store, create the user in Supabase → Authentication → Users and confirm the email. Then run this in the Supabase SQL Editor, replacing the example email:

```sql
select public.grant_admin('you@example.com');
```

The user can now sign in at `/admin`. To add another admin, repeat those two steps.

If you are running the project in a connected development environment with the Supabase CLI available, `npm run setup` can apply migrations and `npm run admin:create -- you@example.com` can create and grant an admin in one step.

**On the local demo store**, open `/admin/setup` once to create its local owner account.

---

## How ordering works

Shoppers choose how to order at checkout. You decide which methods are offered (Settings → Checkout and payment). **There is no online card-payment gateway in this version.** Bank transfers, cash on delivery and WhatsApp orders are handled manually; confirm receipts externally and update payment status in the dashboard.

| Method | What the shopper does | What you see in Orders |
| --- | --- | --- |
| **Pay on delivery** | Places the order on the website. | A new order, **Received**. |
| **Bank transfer** | Places the order, then sees your bank details and the reference to use. | A new order, **Received**, payment pending. |
| **WhatsApp** | Sees the order written out as a message and opens WhatsApp to send it to you. | A **WhatsApp handoff** — not an order yet. |

**The life of an order**

```
Received ──▶ Confirmed ──▶ Fulfilled ──▶ Completed
    │            │
    └──────┬─────┘
           ▼
       Cancelled
```

- **Confirmed** is when stock is set aside (for products that track stock). Cancelling a confirmed order puts it back.
- Only **Confirmed**, **Fulfilled** and **Completed** orders count as sales on the Overview.
- Shoppers follow their order's status on their private order page.

**Why WhatsApp handoffs are separate.** A website can show the shopper the message and open WhatsApp — but it can't know whether the message was sent. So a WhatsApp order starts as *message prepared*, becomes *opened, unverified* if the shopper taps the button, and only becomes **Received** when you mark it so after finding the message in your chats. Unverified handoffs are never counted as orders or sales, and old ones can be discarded in one click.

**No WhatsApp number yet?** WhatsApp checkout runs as a safe demo: the shopper sees the message, but no chat opens and nothing is sent to anyone. Add your number in Settings → Contact and WhatsApp, in full international format, e.g. `+44 7700 900123`.

---

## More about Supabase

- `npm run db:check` checks your project's security from the outside — what a shopper and a signed-in stranger can and can't do. It creates disposable probe records and users, removes them afterwards, and performs a same-value settings update to check write access. Run it against a dedicated staging project, not production. Set `DB_CHECK_CONFIRMATION=I_CONFIRM_THIS_IS_A_DISPOSABLE_STAGING_PROJECT` to enable it.
- After updating the starter, `npm run db:migrate` applies any new database changes.
- `npm run db:seed` adds or restores the demo products; `npm run db:seed -- --remove` takes them out. You can also do both from **Settings → Demo content** in the dashboard.
- To start over with a fresh demo store on the local store: `npm run demo:reset` (your current data is moved to `.data-backups/`, never deleted).

### Real Supabase staging checks

The GitHub Actions workflow can also test the real Supabase database, including competing stock reservations, shared rate limits, RLS permissions and browser checkout. It runs only on pushes to `main`, and only when the following repository secrets are configured:

| GitHub repository secret | Purpose |
| --- | --- |
| `STAGING_SUPABASE_URL` | Dedicated staging Supabase project URL |
| `STAGING_SUPABASE_PUBLISHABLE_KEY` | Staging publishable key |
| `STAGING_SUPABASE_SECRET_KEY` | Staging secret key |
| `STAGING_ADMIN_EMAIL` | Existing staging admin email |
| `STAGING_ADMIN_PASSWORD` | Staging admin password |
| `STAGING_TESTS_CONFIRMATION` | Must equal `I_CONFIRM_THIS_IS_A_DISPOSABLE_STAGING_PROJECT` |

Apply the migrations to the staging project in order, create its admin and grant admin access before adding these secrets. The browser suite resets the staging demo settings and catalogue after running. Use a disposable staging project with no real customer data; never put production credentials in these secrets.


<details>
<summary><strong>Without the CLI</strong></summary>

1. In Supabase → SQL Editor, run each migration file separately, in this exact chronological order:
   - [`20261026000000_storefront_schema.sql`](supabase/migrations/20261026000000_storefront_schema.sql)
   - [`20261116000000_atomic_stock_and_rate_limits.sql`](supabase/migrations/20261116000000_atomic_stock_and_rate_limits.sql)
   - [`20261116050000_complete_order_anonymisation.sql`](supabase/migrations/20261116050000_complete_order_anonymisation.sql)
   - [`20261117000000_derive_order_stock_effect.sql`](supabase/migrations/20261117000000_derive_order_stock_effect.sql)

   Run one file at a time. Do not combine the SQL files into one query. Each migration is designed to be safe to re-run.
2. In Supabase → Authentication → Sign In / Providers, turn off **Allow new users to sign up**.
3. Add the first owner in Supabase → Authentication → Users and confirm the email. Then run `select public.grant_admin('you@example.com');` in the SQL Editor, using the same email.
4. Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` to the hosting provider's server-side environment variables. See [`.env.example`](.env.example) for the names. Never expose the secret key through a `NEXT_PUBLIC_` variable.

</details>

---

## Customize it

**Without code** — the dashboard's Storefront and Settings pages. Changes are live as soon as you save.

To let visitors try a copy of your store and look around its dashboard without changing anything, see *Public demo mode* in [Advanced configuration](docs/advanced-configuration.md).

**With code**

- **Colours and type**: `src/app/globals.css` holds the design tokens. `src/lib/theme.ts` turns the owner's accent, type pairing and corners into CSS variables, and keeps text readable on any accent.
- **Fonts**: `src/app/fonts.ts` (self-hosted by `next/font` — shoppers' browsers never call Google).
- **Words in the shop**: `src/lib/i18n/en.ts`, `fr.ts`, `es.ts`, `ar.ts`. To add a language, copy `en.ts`, translate it, and register it in `src/lib/i18n/languages.ts` and `src/lib/i18n/index.ts`. TypeScript tells you if a translation misses a key.
- **Checkout rules**: `src/lib/domain/checkout.ts`. **The WhatsApp message**: `src/lib/domain/whatsapp.ts`. **Order states**: `src/lib/domain/orders.ts`.
- **The demo store**: `src/lib/demo/` (settings, categories, products) and `public/demo/` (photos — see `public/demo/CREDITS.md`).
- **The database**: `supabase/migrations/`. Add a new file for each change (`<timestamp>_<name>.sql`) and write it so it can safely run more than once, like the first one — `npm run db:migrate` applies them all, in order.

---

## How the code is organized

```
src/
  app/
    (store)/           the shop: home, shop, categories, collections, products,
                       cart, checkout, order pages, info pages
    admin/             the dashboard (its own layout, always English)
    api/               photo uploads, the "WhatsApp opened" beacon
    media/             serves local-store uploads
  components/
    store/             shop components
    admin/             dashboard components
  lib/
    domain/            business rules: money, products, variants, stock, cart,
                       checkout, orders, settings — pure and unit-tested
    i18n/              shop translations
    demo/              the fictional demo store
  server/
    backend/           local/ and supabase/ — one interface, two stores
    actions/           server actions for the shop and the dashboard
    demo/              public demo mode: dashboard preview, in-memory orders
    admin.ts           who is signed in (checked by every dashboard action)
  proxy.ts             keeps Supabase sessions fresh on dashboard requests
supabase/
  migrations/          tables, row-level security, storage, atomic functions
  config.toml          the CLI settings `npm run setup` pushes (sign-ups off)
scripts/               setup, migrations, demo data, admin account, privacy check
tests/e2e/             end-to-end tests (Playwright)
```

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on <http://localhost:3000> |
| `npm run setup` | Connects a Supabase project: database, keys, demo products, admin, sign-ups off |
| `npm run db:migrate` | Applies the database migrations to the project in `.env.local` |
| `npm run db:seed` | Adds or restores the demo products (`-- --settings` also restores the demo settings, `-- --remove` removes them) |
| `npm run db:check` | Checks the project's security from the outside (17 checks; changes nothing) |
| `npm run admin:create -- you@example.com` | Creates an admin account, or resets its password |
| `npm run demo:reset` | Local store: back to a fresh demo store (old data kept in `.data-backups/`) |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit and database tests (Vitest; database tests run Postgres in-process with PGlite) |
| `npm run test:e2e` | Builds, then runs the browser tests (Playwright) |
| `npm run privacy:check` | Scans the project and the build for secrets and blocklisted details |
| `npm run verify` | typecheck → lint → tests → privacy check → build |

---

## Tests

- `npm test` — business rules (pricing, variants, stock, cart, checkout validation, order lifecycle, WhatsApp messages, settings), the demo store and public demo mode, and the database: row-level security, permissions, the admin role and the atomic order functions, run on real Postgres.
- `npm run test:e2e` — a production build in a real browser, on two throwaway local stores (one in public demo mode): owner setup, access control, products with photos and variants, categories, collections, settings reflected in the shop, Arabic right-to-left, every checkout method, the order lifecycle with stock, the guest dashboard preview, and no sideways scrolling from 320 px to 1440 px.

  Playwright needs a browser once: `npx playwright install chromium`. Rerun without rebuilding: `npx playwright test`. Running them against a real Supabase project is described in [Advanced configuration](docs/advanced-configuration.md).

The end-to-end tests never contact WhatsApp or any other service.

---

## Security and privacy

- **Keys**: the Supabase secret key stays on the server. No setting is `NEXT_PUBLIC_`, so nothing reaches a visitor's browser. `.env*` files are ignored by git, except the empty template. Setup never prints a key.
- **Database**: row-level security on every table, and explicit permissions on top. The public key can read published products, visible categories and collections, and the settings — nothing else. Orders and the admin list are closed to it entirely; the server creates orders with the secret key. Only accounts listed in `admin_users` can change anything, and the dashboard queries Supabase *as the signed-in admin*, so the database checks the role a second time.
- **Dashboard**: every page and every action checks the session itself. Never indexed by search engines, never framed.
- **Checkout**: inputs validated on the server, prices and stock re-checked when the order is placed, a hidden field and a minimum fill time against bots, and per-visitor rate limits.
- **Order pages**: reachable only through the private link given to the shopper; only a hash of that link's secret is stored.
- **Photos**: the file type is read from the file's bytes, not its name; size-limited; uploads need an admin session.

**Privacy check.** `npm run privacy:check` scans every file and the build output for secret keys, committed `.env` files, and phone numbers hard-coded into WhatsApp links. It also checks a private blocklist: `npm run privacy:check -- --add` stores a detail that must never appear in your code — a previous client's name or phone number, for example — as a hash in `.privacy/` (ignored by git). Findings show your label, never the value.

---

## Troubleshooting

**"The store can't reach its database" / "No database is configured"** — one of the three Supabase variables is missing or wrong, or the database hasn't been set up. Run `npm run setup` (or `npm run db:migrate`), and check the three variables on your host. The dashboard's sign-in page says which.

**`npm run setup` says you're not signed in** — run `npx supabase login` first.

**Checkout says ordering is unavailable** — every checkout method is switched off in Settings → Checkout and payment.

**WhatsApp shows the message but doesn't open a chat** — no WhatsApp number is set, so WhatsApp checkout is in demo mode. Add it in Settings → Contact and WhatsApp.

**"Use the full international number"** — WhatsApp needs the country code: `+44 7700 900123`, not `07700 900123`.

**Photos from Supabase don't show** — your project uses a custom domain: set `SUPABASE_URL` to it and rebuild.

**Forgot the admin password** — `npm run admin:create -- you@example.com` (add `--replace` on the local store).

**`/admin/setup` says setup is locked** — the store is running in production on the local store. Connect Supabase instead (or see [Advanced configuration](docs/advanced-configuration.md)).

---

## License

The code is MIT-licensed — see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). Not included in that license: the demo photographs in `public/demo` (stock photos under their own licenses, listed in [public/demo/CREDITS.md](public/demo/CREDITS.md)) and the brand icons, which are trademarks of their owners.
