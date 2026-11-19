# FreshCart (QA Simulation Lab build)

Runnable web shop for the Notion "QA Simulation Lab". It is built from the acceptance criteria and
designs in Notion **plus 35 seeded defects** that trainee QA engineers must find by comparing the app
with the criteria and designs. This README is for facilitators: it contains the answer key.

## Run

```bash
cd qa-lab-apps/freshcart
npm install
npm start                 # training build with seeded defects on http://localhost:3201
npm run start:reference   # reference build (no defects, all features) for checking the answer key
npm run check             # tests with coverage (needs 80% lines)
```

No credentials are needed. Environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3201` | Port to listen on |
| `SEEDED_DEFECTS` | `on` | `off` starts the reference build: no seeded defects and the features that are "Not built yet" in the training build |
| `FIXED_NOW` | `2026-11-19T15:00:00` | Clock of the shop (the walkthrough clock). `off` uses the real time, or give an ISO date |

All data is in memory: restart the server to reset carts and orders.

## Where each feature is

| Feature | Status in training build | URL |
|---|---|---|
| F1.1 Product listing | Complete | `/products` |
| F1.2 Search with suggestions | Complete | header search box, `/search?q=Sut` |
| F1.3 Category and price filters | Partial (no filter chips, no mobile Filters panel) | `/products` sidebar |
| F1.4 Product detail | Partial (no breadcrumb, thumbnails do not switch the image) | `/products/12` |
| F1.5 Out of stock and Notify me | Stub (hard-coded stock, Notify me does nothing) | `/products/12`, `/products/11` |
| F2.1 Add to cart, mini-cart | Complete | header cart button |
| F2.2 Cart page and totals | Complete | `/cart` |
| F2.3 Promo code | Partial (tax not recalculated after discount, no Remove) | `/cart` |
| F2.4 Delivery slot and address | Partial (no hold countdown) | `/checkout/delivery` |
| F2.5 Payment and confirmation | Stub (mock payment service) | `/checkout/payment`, `/order/confirmation` |

Helper page: `/dev/orders` lists the orders of the mock payment service.
Test data: 48 products in 8 categories, product 12 is `Sut, to'liq yog'li 1 l` (Whole Milk 1L, 4 images, stock 0), `Yunon yogurti` (Greek Yogurt) stock 3,
`Jigarrang tuxum` (Brown Eggs) stock 6, promo codes `FRESH10`, `SAVE5`, `SUMMER20` (expired), decline test card
`4000 0000 0000 0002`, success test card `4242 4242 4242 4242`. The Friday 20 Nov 10:00-12:00 slot is full.

The reference build (`SEEDED_DEFECTS=off`) satisfies every acceptance criterion and design. In it `Sut, to'liq yog'li 1 l`
is out of stock (that is the F1.5 rule), so use another product to test the cart there.

## Language: Uzbek

All user-visible text (screens, messages, seed products, emails-like texts, day and month names) is Uzbek, Latin
script. Facilitator-facing text stays English: this README, `src/defects.js`, code comments, the console message
at start. The exact Uzbek labels and messages are in `UZ_MESSAGES.md`.

Search words of the walkthrough (the products were renamed, so the words changed):

| Walkthrough step (Notion) | English word | Uzbek word |
|---|---|---|
| One character opens suggestions (`FC_SUGGEST_ONE_CHAR`) | `m` | `a` |
| Capitalised word: 4 results (`FC_SEARCH_CASE_SENSITIVE`) | `Mil`, `Milk` | `Sut` |
| Same word in lower case: no results | `milk` | `sut` |

The four products found by `Sut` are `Sut, jo'xori 1 l`, `Sut, soya 1 l`, `Sut, to'liq yog'li 1 l` and
`Sut, yog'sizlantirilgan 1 l`. No other product name contains the letters `sut` in lower case, so in the training
build the lower-case search finds nothing and in the reference build it finds the same four. Other walkthrough
steps are unchanged: promo code `fresh10` in lower case, the 60-character word, the decline card, `Ju 20 Noy`
(Friday 20 Nov) slot. Day names are `Du Se Ch Pa Ju Sh Ya`, months `Yan Fev Mar Apr May Iyn Iyl Avg Sen Okt Noy Dek`.

## Answer key: defect id, Notion defect, file

Every defect is one `if (defects.ID)` branch with a comment naming the id, next to the correct code.

| Defect id | Notion defect title | File |
|---|---|---|
| `FC_PAGE_SIZE_10` | Only 10 products per page | `src/domain/catalog.js` |
| `FC_PRICE_ONE_DECIMAL` | Prices shown with 1 decimal | `public/js/format.js` |
| `FC_SORT_PRICE_DESC_ASC` | Price high to low sorts ascending | `src/domain/catalog.js` |
| `FC_SUGGEST_ONE_CHAR` | Suggestions appear after 1 character | `src/domain/catalog.js`, `public/js/rules.js` |
| `FC_SEARCH_CASE_SENSITIVE` | Search is case-sensitive | `src/domain/catalog.js` |
| `FC_SEARCH_XSS_HEADING` | Search term is rendered as HTML in the results heading (XSS) | `public/js/ui/chrome.js` |
| `FC_SEARCH_NO_MAXLENGTH` | 50-character limit not enforced in search box | `public/js/rules.js` |
| `FC_PRICE_MAX_EXCLUSIVE` | Price Max is exclusive | `src/domain/catalog.js` |
| `FC_PRICE_MIN_GT_MAX_NO_ERROR` | No error when Min is greater than Max | `src/domain/catalog.js` |
| `FC_CATEGORY_URL_NOT_UPDATED` | Category filter does not update the URL | `public/js/rules.js` |
| `FC_DETAIL_THREE_IMAGES` | Only 3 of 4 images shown | `public/js/rules.js` |
| `FC_STEPPER_MAX_11` | Quantity stepper allows 11 | `public/js/rules.js` |
| `FC_TOAST_ONE_SECOND` | Toast disappears after 1 second | `public/js/rules.js` |
| `FC_DETAIL_404_BLANK` | Unknown product id shows a blank page | `public/js/rules.js` |
| `FC_OOS_ADD_ENABLED` | Add to cart still possible on out-of-stock product | `src/services/CartService.js`, `public/js/rules.js` |
| `FC_LOW_STOCK_AT_6` | Low-stock text shown for stock 6 | `public/js/rules.js` |
| `FC_BADGE_COUNTS_LINES` | Cart badge counts lines, not units | `public/js/rules.js` |
| `FC_CART_DUPLICATE_LINE` | Same product creates a duplicate cart line | `src/domain/cart.js` |
| `FC_CART_LIMIT_100` | Quantity limit is 100, not 99 | `src/domain/cart.js` |
| `FC_CART_NOT_PERSISTED_ACROSS_TABS` | Cart is lost when the tab is closed | `public/js/rules.js` |
| `FC_FREE_DELIVERY_35` | Free delivery threshold is $35 instead of $30 | `src/domain/pricing.js` |
| `FC_TAX_ON_DELIVERY` | Tax calculated on subtotal plus delivery | `src/domain/pricing.js` |
| `FC_EMPTY_CART_BLANK` | Empty cart shows a blank page | `public/js/rules.js` |
| `FC_PROMO_CASE_SENSITIVE` | Promo codes are case-sensitive | `src/domain/promo.js` |
| `FC_PROMO_MIN_NOT_ENFORCED` | FRESH10 minimum subtotal not enforced | `src/domain/promo.js` |
| `FC_PROMO_EXPIRED_MESSAGE` | Expired code shows the wrong message | `src/domain/promo.js` |
| `FC_PROMO_STACKING` | Two promo codes stack | `src/domain/promo.js` |
| `FC_PHONE_ACCEPTS_LETTERS` | Phone field accepts letters | `src/shared/validation.js` |
| `FC_ZIP_FOUR_DIGITS` | ZIP accepts 4 digits | `src/shared/validation.js` |
| `FC_FULL_SLOT_SELECTABLE` | Full delivery slot can be selected | `src/domain/delivery.js` |
| `FC_SAME_DAY_CUTOFF_1H` | Same-day cutoff is 1 hour, not 2 hours | `src/domain/delivery.js` |
| `FC_NO_LUHN` | Card number is not Luhn-validated | `src/shared/validation.js` |
| `FC_EXPIRY_MONTH_ONLY` | Expiry checked by month only (also refuses valid future dates such as 05/30 and the design example 08/29) | `src/shared/validation.js` |
| `FC_DOUBLE_SUBMIT_TWO_ORDERS` | Double click on Place order creates two orders | `src/services/CheckoutService.js`, `public/js/glue/pages.js` |
| `FC_DECLINE_SHOWS_CONFIRMATION` | Declined test card shows the confirmation page | `src/domain/payment.js` |

## Architecture

```
src/defects.js, features.js   defect ids and the "not built yet" feature flags (mode on / off)
src/domain/                   pure rules: catalog, cart, pricing, promo, delivery, payment mock
src/shared/                   money and validation, used by the server and the browser
src/data/                     seed data and in-memory repositories
src/services/                 CatalogService, CartService, CheckoutService (depend on repository interfaces)
src/routes/                   thin Express routers; src/app.js is the composition root
public/js/                    browser modules: pure rules and renderers (unit tested) + glue/ (DOM wiring)
test/                         node:test, every defect id with the defect on and off
```

The browser shell, routing and event wiring in `public/js/glue/` are not unit tested; all rules and markup they
use are. Run the app and use it to check the glue.

## Notion storage

The app stores its data in Notion (page "App Data (written by FreshCart and ClinicBook)" in the QA Simulation Lab).
Databases: `FC Products`, `FC Promo Codes` (the catalog, loaded from Notion at startup), `FC Carts`, `FC Orders`
(written on every change). Each row has a `Key`, a readable `Summary` and the whole record as JSON in `Data`.
Do not edit `Data` by hand while the app runs.

One-time setup (you do this, the token never goes into chat or git):

1. Create an internal integration at https://www.notion.so/profile/integrations and share the "QA Simulation Lab" page with it.
2. `cp .env.example .env.local` and put the integration token in `NOTION_TOKEN`.
3. `npm run notion:verify` creates, reads and archives one temporary row in `FC Products` and prints OK or the error.
4. `npm run notion:seed` writes the 48 products and 3 promo codes (safe to repeat; unchanged rows cause no call).
   `npm run notion:seed -- --reset` also archives every cart and order row (a clean slate between groups).
5. `npm start` (training build) or `npm run start:reference`. With `NOTION_TOKEN` set the app uses Notion; without it it
   runs in memory mode and says so at startup (`npm run start:memory` forces memory mode).

How it behaves: reads come from memory (loaded at startup), every cart or order change is queued to Notion (one call at a time,
350 ms apart, retries on 429 and 5xx). A failing write never stops the app: see `GET /api/dev/storage`
(`mode`, `pending`, `lastError`, `lastSyncAt`). Carts older than 7 days are archived. Sessions are not stored anywhere.
Delivery slot places stay in code (they restart with the app).

Env: `NOTION_TOKEN` (secret), `NOTION_PARENT_PAGE_ID` (default `41d2b9c9-59ab-81b3-ba6f-eda97451cd66`), `STORAGE=notion|memory`.

## Postman

`npm run postman:build` writes `../postman/FreshCart.postman_collection.json` and `FreshCart.postman_environment.json`
(import both into Postman by hand). One folder per Notion feature plus `Facilitator tools`; Uzbek descriptions with the
acceptance criteria; basic checks only (status, JSON, key fields). `node ../postman/tools/run-collection.mjs
../postman/FreshCart.postman_collection.json --var baseUrl=http://localhost:3201` runs every request in order and checks them.
The test suite runs the collection against the training and the reference build.
