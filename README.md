# WoodsyCart Admin

Angular 21 admin console (installable PWA) for running the WoodsyCart furniture store. The layout follows the Phoenix e-commerce admin template (vertical sidebar, soft badges, Nunito Sans, `#3874ff`), rebuilt on Bootstrap 5, Bootstrap Icons and ECharts.

## Pages

| Section | Pages |
| --- | --- |
| Home | E-commerce dashboard: sales vs previous period, orders, new customers, estimated profit, sales by category, payment methods, order status, latest orders, top products and areas, "needs your attention" list |
| Sales | Orders (tabs: needs action, with vendor, missing bill/invoice, payment due), order details (status workflow, WhatsApp/PO to vendor, vendor bills, payments, refunds, invoice, profit), customers, customer details, returns & refunds, enquiries |
| Catalogue | Products (margin view, vendor price changes, bulk publish/feature/commission), add/edit product (pricing preview, variants, images, SEO), categories (commission per category) and collections, reviews, coupons, home banners |
| Vendor | Vendor & catalogue sync (live progress, history), vendor bills (payables, payments, attachments) |
| Finance | Profit & loss (statement, monthly trend, GST summary, cash position, profit by order, CSV/print), customer invoices (PDF, sales register CSV), expenses |
| Settings | Delivery pincodes, business/GST/invoice settings, pricing & commission, delivery & payments, team & password |

## Run locally

```bash
npm install
npm start          # http://localhost:4300 (API expected at http://localhost:5100)
```

Sign in with the admin account created by the API (see the API README).

## Configuration

Addresses are read at startup from `public/config.json` (copied next to `index.html` in the build), so the same build runs locally or live. Locally:

```json
{ "apiUrl": "http://localhost:5100", "storefrontUrl": "http://localhost:4200" }
```

On the server, edit `config.json` in the deployed folder (see the API repo: `docs/deployment/hosting-guide.md`, section 8.1). No rebuild is needed.

## Build and install as an app

```bash
npm run build      # output: dist/woodsy-cart-admin/browser
```

Deploy the `browser` folder to any static host over HTTPS, and configure SPA fallback to `index.html`. The service worker is active in production builds, so you can install the console on a phone or desktop from the browser's "Install app" / "Add to Home screen".
