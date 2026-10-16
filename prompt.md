# CafeOS — Multi-Business Restaurant Management Platform
## AI Agent Build Specification

> Feed this entire file to your coding agent as the master spec. It is written so the agent can work module-by-module without losing context. Do not let the agent skip the **Loop Engineering Protocol** in Section 9 — it is what keeps a multi-week build from drifting.

---

## 0. Role Instruction for the Agent

You are acting as a **senior full-stack developer + product architect**. You are not just writing code snippets — you are building a production-grade, multi-tenant SaaS platform. Before writing any code:

1. Read this entire file once, fully.
2. Restate the plan back in your own checklist (Section 8) before starting.
3. Build in the phase order given. Do not jump ahead to Phase 4 features while Phase 1 is incomplete.
4. After every module, self-verify against the "Definition of Done" for that module before marking it complete.

---

## 1. Product Vision

**Working name:** CafeOS
**What it is:** Not a single cafe's website — a white-label Restaurant Management System (RMS). One codebase, many businesses (cafe, restaurant, bakery, juice center, tiffin service, cloud kitchen), differentiated by an `industry_type` field set at owner onboarding.

**Primary users (roles):**
- `customer` — browses, orders, tracks, pays
- `owner` / `admin` — manages menu, orders, staff, reports
- `staff` — sub-roles: `cashier`, `chef`, `manager` (scoped permissions)
- `delivery_partner` — sees assigned deliveries, updates location
- `platform_admin` (you) — the SaaS-level super-admin who onboards new businesses later

**North Star:** A customer should go from "landing on the site" to "order placed and tracked" in under 90 seconds, and an owner should be able to run their entire shop's daily ops (menu, orders, staff, marketing) from one dashboard without touching a database.

---

## 2. Tech Stack (Final Decision)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS | Fast dev loop, matches your existing stack conventions |
| Backend | Node.js + Express | Matches your salon-booking-app stack, reusable patterns |
| Database | **PostgreSQL** (via Prisma ORM) | Multi-tenant SaaS needs relational integrity (orders → items → customers → business). Recommend over MongoDB here — foreign keys matter a lot once coupons, loyalty points, and reports start joining across tables. If you strongly prefer Mongo, swap Prisma for Mongoose and treat every "table" below as a "collection." |
| Auth | JWT (access + refresh token pattern) | Stateless, scales across roles |
| Real-time | Socket.io | Order status pushes + live delivery tracking |
| Maps | Leaflet + OpenStreetMap | Free, no Google Maps API cost |
| Notifications | WhatsApp-web.js (or Baileys) for free tier → migrate to WhatsApp Cloud API later | Matches your open-wa precedent from the salon project |
| Image storage | Cloudinary | Free tier, direct upload from React |
| Push notifications | Firebase Cloud Messaging | Owner alerts for new orders |
| Deployment | Vercel (frontend) + Render/Railway (backend) + Neon/Supabase (Postgres) | Free-tier friendly |
| Payments | Manual QR + UTR verification (Phase 1) → Razorpay (Phase 2) | Zero cost to launch |

---

## 3. Design System (UI/UX) — "Appetite-First, Zero Dark Mode"

**Hard constraint: There is no dark theme, no dark mode toggle, anywhere in this product — not on the customer site, not on the owner dashboard, not on the delivery app.** Every screen uses a warm, light, appetizing palette. If the agent is tempted to default to a dark admin dashboard template (common in AI-generated UIs), it must override that instinct here.

### 3.1 Color Palette — chosen specifically to trigger appetite (food psychology: warm reds/oranges/yellows stimulate hunger; blues/purples suppress it — so blue/purple are banned from primary UI)

```css
:root {
  /* Backgrounds — warm, creamy, never stark white, never dark */
  --bg-base:        #FFF8F0;   /* warm ivory */
  --bg-surface:      #FFFFFF;   /* cards */
  --bg-subtle:       #FDECD8;   /* soft peach section backgrounds */

  /* Primary — chili/tomato red: the classic "hungry" trigger color */
  --color-primary:      #E4572E;
  --color-primary-hover:#C8451F;

  /* Secondary — turmeric/mustard: warmth + optimism, great for CTAs & offers */
  --color-secondary:    #F4A300;

  /* Accent — burnt terracotta, used for highlights, badges, "Best Seller" tags */
  --color-accent:       #E76F51;

  /* Text — warm dark roast brown, NOT pure black (softer, more inviting) */
  --text-primary:       #3A2618;
  --text-secondary:     #7A5C4B;

  /* Status colors */
  --color-success:      #6A9955;  /* fresh basil green - "Delivered/Available" */
  --color-warning:      #F4A300;  /* "Preparing" */
  --color-error:        #D64550;  /* "Cancelled/Out of Stock" */
  --color-info:         #457B9D;  /* used sparingly only for links/info, never as a dominant color */

  /* Borders/dividers */
  --border-subtle:      #F0DCC4;
}
```

### 3.2 Typography
- Headings: a rounded/friendly serif or slab-serif (e.g. `"Fraunces"`, `"Lora"`) — gives a "handwritten menu board" warmth.
- Body: a clean sans-serif (`"Inter"` or `"Plus Jakarta Sans"`) for legibility on menu cards and dashboard tables.
- Prices: always bold, always in `--color-primary` or `--text-primary` — never grey/muted (grey prices feel like an afterthought).

### 3.3 Visual language rules
- Food photography is the hero everywhere — large, high-contrast cards, subtle warm-toned shadow (not flat grey shadow — use a soft `rgba(228, 87, 46, 0.08)` tinted shadow).
- Rounded corners (12–20px) on cards — feels friendly, not corporate.
- Use texture sparingly: a very subtle paper/linen background texture on the customer homepage hero is allowed; dashboard stays clean/flat.
- "Best Seller," "Spicy 🌶️," "Chef's Special" badges use the secondary/accent colors as filled pill tags.
- Veg/Non-Veg indicator: standard green square (veg) / red-brown triangle (non-veg) dot per Indian food-app convention — do not invent a new symbol.
- Owner dashboard uses the **same palette**, just with more white/ivory space and data-dense tables — it is a light admin theme, never a dark admin theme.

### 3.4 Definition of Done for design system
- [ ] Tailwind config extended with all tokens above (no raw hex codes used inline anywhere in components)
- [ ] Light theme only — confirm no `dark:` Tailwind classes exist anywhere in the codebase
- [ ] Google Fonts imported and applied globally
- [ ] A shared `<Badge>`, `<PriceTag>`, `<VegIndicator>` component built once, reused everywhere

---

## 4. Architecture Overview — How Everything Connects

```
                        ┌─────────────────────┐
                        │   Customer Web App    │
                        │ (React - public)      │
                        └──────────┬───────────┘
                                   │ REST + Socket.io
                        ┌──────────▼───────────┐
                        │     Express API       │
                        │  (single backend,     │
                        │  business_id scoped)  │
                        └──┬─────────┬─────────┬┘
             ┌─────────────┘         │         └─────────────┐
   ┌─────────▼────────┐   ┌──────────▼─────────┐   ┌─────────▼─────────┐
   │  Owner Dashboard  │   │  Delivery Partner    │   │  WhatsApp Gateway  │
   │  (React - admin)  │   │  App (React/PWA)     │   │  (webhook service) │
   └───────────────────┘   └───────────────────────┘   └─────────────────┘
                                   │
                        ┌──────────▼───────────┐
                        │  PostgreSQL (Prisma)  │
                        │  every table has      │
                        │  business_id FK        │
                        └───────────────────────┘
```

**Key architectural rule (this is what makes it multi-tenant/SaaS-ready):** every table below carries a `business_id`. Every API route is scoped by the authenticated user's `business_id` (except the future `platform_admin` routes). This is the one decision that turns "a cafe website" into "a platform" — bake it in from day one, do not retrofit it later.

---

## 5. Database Schema

```prisma
// ── Core tenancy ─────────────────────────────
model Business {
  id            String   @id @default(uuid())
  name          String
  industryType  String   // cafe | restaurant | bakery | juice_center | tiffin | cloud_kitchen
  address       String
  gstNumber     String?
  openingTime   String
  closingTime   String
  deliveryRadiusKm Float
  minOrderAmount   Float
  packingCharge    Float
  deliveryCharge   Float
  upiId            String?
  qrCodeUrl        String?
  phoneNumber      String
  whatsappNumber   String
  createdAt     DateTime @default(now())
}

// ── Users & roles ────────────────────────────
model User {
  id           String   @id @default(uuid())
  businessId   String?  // null for customers who order across businesses
  role         String   // customer | owner | cashier | chef | manager | delivery_partner
  name         String
  phone        String   @unique
  email        String?
  passwordHash String?
  createdAt    DateTime @default(now())
}

model Customer {
  id            String   @id @default(uuid())
  userId        String   @unique
  businessId    String
  totalOrders   Int      @default(0)
  totalSpent    Float    @default(0)
  loyaltyPoints Int      @default(0)
  lastOrderAt   DateTime?
  birthday      DateTime?
  isPremium     Boolean  @default(false)
}

// ── Menu ─────────────────────────────────────
model Category {
  id         String @id @default(uuid())
  businessId String
  name       String
  sortOrder  Int
}

model MenuItem {
  id           String   @id @default(uuid())
  businessId   String
  categoryId   String
  name         String
  description  String?
  price        Float
  discountPct  Float    @default(0)
  imageUrl     String?
  isVeg        Boolean
  isAvailable  Boolean  @default(true)
  rating       Float    @default(0)
}

model AddOn {
  id         String @id @default(uuid())
  menuItemId String
  name       String
  price      Float
}

// ── Cart & Orders ────────────────────────────
model Order {
  id              String   @id @default(uuid())
  businessId      String
  customerId      String
  orderType       String   // pickup | delivery
  status          String   // received | accepted | preparing | ready | out_for_delivery | delivered | cancelled
  subtotal        Float
  packingCharge   Float
  deliveryCharge  Float
  gst             Float
  discount        Float
  total           Float
  paymentStatus   String   // pending | utr_submitted | verified | paid_online | failed
  paymentUtr      String?
  couponCode      String?
  deliveryAddress String?
  deliveryPartnerId String?
  createdAt       DateTime @default(now())
}

model OrderItem {
  id         String @id @default(uuid())
  orderId    String
  menuItemId String
  quantity   Int
  priceEach  Float
  addOns     Json   // [{name, price}]
}

model OrderStatusLog {
  id        String   @id @default(uuid())
  orderId   String
  status    String
  timestamp DateTime @default(now())
}

// ── Delivery ─────────────────────────────────
model DeliveryTracking {
  id         String   @id @default(uuid())
  orderId    String
  latitude   Float
  longitude  Float
  updatedAt  DateTime @default(now())
}

// ── Marketing / CRM ──────────────────────────
model Coupon {
  id           String   @id @default(uuid())
  businessId   String
  code         String
  discountType String   // percentage | fixed | free_delivery
  value        Float
  expiresAt    DateTime?
  usageLimit   Int?
}

model Review {
  id         String @id @default(uuid())
  orderId    String
  customerId String
  rating     Int
  comment    String?
}

model Referral {
  id             String @id @default(uuid())
  referrerId     String
  refereeId      String
  rewardIssued   Boolean @default(false)
}

// ── Ops ───────────────────────────────────────
model InventoryItem {
  id           String @id @default(uuid())
  businessId   String
  name         String
  unit         String   // kg | litre | pcs
  currentStock Float
  lowStockAt   Float
}

model Employee {
  id         String @id @default(uuid())
  userId     String
  businessId String
  role       String   // cashier | chef | manager | delivery_partner
  permissions Json
}
```

### 5.1 Definition of Done for database
- [ ] Every table has `businessId` except `User`/`OrderStatusLog`/child tables (which inherit scope via parent)
- [ ] Prisma migrations run cleanly on a fresh Postgres instance
- [ ] Seed script creates 1 demo business + 10 demo menu items + 3 demo customers for local testing

---

## 6. API Inventory

Grouped by module. **Total: ~54 endpoints** across 10 modules. All routes are prefixed `/api/v1` and (except `/auth/*` and public menu reads) require a JWT with role + `business_id` claim.

| # | Module | Endpoints |
|---|---|---|
| 1 | **Auth** (6) | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/otp/send`, `POST /auth/otp/verify` |
| 2 | **Menu** (8) | `GET /menu`, `GET /menu/:id`, `POST /menu` (owner), `PUT /menu/:id`, `DELETE /menu/:id`, `PATCH /menu/:id/availability`, `GET /categories`, `POST /categories` |
| 3 | **Cart** (4) | `GET /cart`, `POST /cart/items`, `PUT /cart/items/:id`, `DELETE /cart/items/:id` |
| 4 | **Orders** (8) | `POST /orders`, `GET /orders/:id`, `GET /orders` (owner, filterable), `PATCH /orders/:id/status`, `PATCH /orders/:id/cancel`, `GET /orders/:id/track`, `POST /orders/:id/payment/utr`, `PATCH /orders/:id/payment/verify` |
| 5 | **Delivery** (5) | `GET /delivery/assigned`, `PATCH /delivery/:orderId/location`, `PATCH /delivery/:orderId/complete`, `GET /delivery/:orderId/route`, `POST /delivery/assign` (owner) |
| 6 | **CRM / Customers** (5) | `GET /customers`, `GET /customers/:id`, `GET /customers?filter=premium\|new\|inactive`, `POST /customers/bulk-message`, `PATCH /customers/:id` |
| 7 | **Marketing** (6) | `GET/POST/PUT/DELETE /coupons`, `POST /coupons/validate`, `POST /reviews` |
| 8 | **Owner Dashboard / Reports** (6) | `GET /dashboard/summary`, `GET /reports/sales?range=`, `GET /reports/top-items`, `GET /reports/peak-hours`, `GET /reports/repeat-customers`, `GET /reports/avg-order-value` |
| 9 | **Ops (Inventory + Staff)** (6) | `GET/POST/PUT /inventory`, `GET/POST/PUT /employees` |
| 10 | **Settings & Notifications** (5) | `GET/PUT /settings`, `POST /notifications/whatsapp/send`, webhook `POST /webhooks/whatsapp/incoming` |

> Loyalty points and referral rewards are computed as side-effects inside the Order-status webhook (on `delivered`), not separate endpoints — keeps the API surface smaller.

### 6.1 Definition of Done for API layer
- [ ] Every endpoint has request/response validated with Zod (or Joi)
- [ ] Every endpoint scoped to `req.user.businessId` except explicitly public ones (`GET /menu`, `POST /auth/*`)
- [ ] Postman/Thunder Client collection exported and committed to repo

---

## 7. Module-by-Module Functional Spec

### 7.1 Customer Website
Home → category/veg/price/rating filters → Menu (photo, addons, qty) → Cart (coupon, packing/delivery charge, GST) → Checkout (pickup or delivery branch) → Order confirmation.
**Connects to:** Menu API, Cart API, Coupon validate API, Orders API.

### 7.2 Order Tracking
Status enum drives a horizontal stepper UI: `received → accepted → preparing → ready → out_for_delivery → delivered`. Socket.io room per `orderId` pushes live updates; falls back to polling every 15s if socket disconnects.
**Connects to:** Orders API, Socket.io, DeliveryTracking table.

### 7.3 Owner Dashboard
Live counters (today's sales, pending/preparing/delivered/cancelled), new-order push notification card with Accept/Reject, menu CRUD, settings form (packing/delivery charge, hours, radius, UPI/QR).
**Connects to:** Dashboard API, Menu API, Settings API, FCM for push alerts.

### 7.4 CRM
Customer list auto-populated from `Order`+`Customer` tables. Filters (premium/new/inactive/delivery-only/pickup-only) are just parametrized queries on `Customer`. Bulk WhatsApp/SMS/birthday-wish triggers the WhatsApp gateway with a templated message.
**Connects to:** Customers API, WhatsApp gateway service.

### 7.5 Delivery Partner App
Login → list of assigned deliveries → tap to open Leaflet map with route → call/navigate buttons (native `tel:`/maps deep-link) → "Complete Delivery" button. Location auto-posts to `DeliveryTracking` every 30–60s via `navigator.geolocation.watchPosition`.
**Connects to:** Delivery API, Leaflet/OSM, customer-facing tracking view (same table, read side).

### 7.6 WhatsApp Integration
On order-accept: template message to customer with order id/ETA/tracking link. On new order: template to owner's WhatsApp. Built on `whatsapp-web.js` (free, QR-login session) behind a small Node microservice so a WhatsApp session crash doesn't take down the main API.
**Connects to:** Orders status-change webhook → Notifications module.

### 7.7 Payments (Phase 1)
QR code shown at checkout → customer manually enters UTR → order sits in `payment_status: utr_submitted` → owner verifies/rejects from dashboard → only verified orders move to `accepted`. Razorpay integration is a drop-in replacement for Phase 2 (swap the payment step, not the order state machine).

### 7.8 Reports
Pre-aggregated queries (not raw table dumps) for daily/weekly/monthly sales, top/least-selling items, peak hour histogram, repeat-customer %, AOV. Rendered with Recharts on the dashboard.

### 7.9 Inventory (Future flag, build schema now, UI later)
Stock decremented per completed order line item (mapped item→ingredient is a stretch goal — v1 can be manual stock decrement by owner). Low-stock triggers an owner notification.

### 7.10 Loyalty / Coupons / Referral
₹100 spent → 10 points (computed on `delivered`). Coupons validated server-side at cart time (never trust client-side discount math). Referral reward issued once referee's first order is `delivered`.

---

## 8. Build Checklist (Phased)

### Phase 0 — Foundation
- [ ] Monorepo structure: `/apps/customer-web`, `/apps/owner-dashboard`, `/apps/delivery-app`, `/apps/api`, `/packages/ui` (shared design system components)
- [ ] Tailwind config with design tokens from Section 3
- [ ] Prisma schema from Section 5, migrated + seeded
- [ ] Auth (JWT access+refresh, role middleware, `business_id` scoping middleware)

### Phase 1 — Core Ordering Loop (MVP — ship this first, end to end)
- [ ] Menu browse + filters (customer web)
- [ ] Cart + checkout (pickup/delivery branch)
- [ ] Order creation + QR/UTR payment flow
- [ ] Owner dashboard: new-order notification, accept/reject, status update
- [ ] Order tracking stepper (customer side) via Socket.io
- [ ] **Milestone test:** a fake customer can place a real order and the owner can accept it and mark it delivered, end to end, no bugs.

### Phase 2 — Delivery + Communication
- [ ] Delivery partner login + assigned orders list
- [ ] Leaflet live tracking (both delivery app posting, customer app reading)
- [ ] WhatsApp gateway microservice + order-accept/new-order templates

### Phase 3 — Growth Tools
- [ ] CRM customer list + filters
- [ ] Bulk WhatsApp campaigns
- [ ] Coupons + Reviews
- [ ] Loyalty points + Referral

### Phase 4 — Owner Ops & Reports
- [ ] Reports dashboard (sales graph, top items, peak hours)
- [ ] Inventory (manual stock + low-stock alert)
- [ ] Employee management with role-scoped permissions

### Phase 5 — SaaS-ification (only after your own cafe is live and stable)
- [ ] `platform_admin` role + business onboarding flow (self-serve signup, pick `industryType`, auto-provision default categories)
- [ ] Subscription/billing layer

---

## 9. Loop Engineering Protocol (read this before writing code)

Do **not** attempt to build this in one giant pass. For each checklist item in Section 8, run this loop:

1. **Plan** — restate the item in 2–3 sentences: what it does, which tables/APIs/components it touches.
2. **Build** — implement the smallest working slice (backend route → frontend consuming it → visible result in the browser).
3. **Self-test** — write or run a quick test (or manually hit the endpoint / click through the UI) and report the actual result, not the expected one.
4. **Compare against Definition of Done** — every module in this doc has one; check it explicitly.
5. **Fix or flag** — if something doesn't match spec (e.g., dark colors crept in, an endpoint isn't scoped by `business_id`), fix it before moving to the next checklist item. If truly blocked, flag it clearly instead of silently working around it.
6. **Report back** — one short status line per completed item (what changed, what to verify manually).

Never mark a checklist box `[x]` without having actually run the code. Never skip ahead to a later phase because a Section 8 item "seems easy" — the ordering exists because later modules depend on earlier ones (e.g., Reports depends on Orders being fully correct first).

---

## 10. Non-Negotiable Constraints (recap)

- ❌ No dark theme / dark mode anywhere, ever.
- ✅ Palette must stay in the warm red/orange/yellow/ivory family (Section 3.1) — no blue/purple as primary UI colors.
- ✅ Every DB table and API route is `business_id`-scoped from day one (multi-tenant by design, not retrofitted).
- ✅ Payment starts manual (QR + UTR), Razorpay is a Phase 2 swap-in, not a Phase 1 blocker.
- ✅ WhatsApp integration uses the free `whatsapp-web.js`/Baileys route first, Cloud API is a later upgrade.
- ✅ Maps use Leaflet + OpenStreetMap — no Google Maps API dependency/cost.