# SMARTPOS — Multi-Tenant Mobile POS & Inventory SaaS

SMARTPOS is a commercial, multi-tenant Mobile Point of Sale (POS) and Inventory SaaS platform engineered for retail businesses operating across multiple stores, registers, and currencies (`PHP ₱` and `USD $`). It delivers an offline-first touch POS terminal, auditable stock ledger, role-based workspace isolation, subscription billing, and a downloadable `SMARTPOS-PRODUCTION.zip` containing the complete Laravel 13 / MySQL 8+ production package alongside the live interactive full-stack web application.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX choices were confirmed during Phase 1 clarification and govern the implementation:

- **Confirmed Decision 1 — Hybrid Live Execution + Laravel 13 Production Package**: We will build a fully functional, live full-stack application in this workspace (Express + TypeScript REST API + React 19 PWA) AND generate a downloadable `SMARTPOS-PRODUCTION.zip` route containing the complete PHP 8.3 / Laravel 13 source code, MySQL 8+ migrations, seeders, Blade/Alpine templates, automated test suite,Nginx/cloud configs, and all 7 required Markdown documentation guides (`README.md`, `INSTALLATION.md`, `DEPLOYMENT.md`, `DATABASE.md`, `SECURITY.md`, `USER_GUIDE.md`, `API_DOCUMENTATION.md`, `TESTING.md`).
- **Confirmed Decision 2 — Embedded Transactional SQLite Database with Demo Seeders**: The live backend will run on an embedded, zero-configuration relational SQLite database with strict `tenant_id` scoping, ACID transactions, integer-scaled decimal arithmetic, and pre-seeded demo credentials (`Superadmin`, `Business Owner`, `Store Manager`, and `Cashier`) so every workflow works out of the box.
- **Confirmed Decision 3 — Dual-Theme High-Density Touch POS Layout**: The interface supports seamless Light and Dark themes (`@custom-variant dark`) with a high-density, ergonomic touchscreen POS layout ($44\times44\text{px}$ minimum hitboxes, single-elevation surfaces, and tabular numerals across all financial views).

---

### 1. Overview & Core Concept

- **What It Does**: Provides a multi-tenant cloud POS and inventory management platform where retail businesses register, subscribe to tiered plans (`Starter $9/mo`, `Business $19/mo`, `Premium $39/mo`), manage multi-store/warehouse stock ledgers, open/close cash registers, process online and offline barcode/touch sales in `PHP` or `USD`, print 58mm/80mm thermal receipts, and analyze true Cost-of-Goods-Sold (COGS) profit reports.
- **Target Audience / Persona**:
  - **Platform Superadmin**: Manages tenants, subscription plans, platform revenue, system health, backups, and global audit logs.
  - **Business Owner**: Manages stores, employees, multi-currency settings (`PHP` / `USD`), suppliers, purchase orders, profit analytics, and SaaS billing.
  - **Store Manager**: Oversees assigned store inventory, stock transfers, stock adjustments, low-stock/expiration alerts, and register variances.
  - **Cashier**: Operates the mobile/tablet touch POS terminal, scans barcodes (camera & USB keyboard wedge), holds/resumes carts, processes split/cash/card/wallet payments, handles offline checkout queues, and reconciles cash drawers.
- **Key Value**: Eliminates revenue loss during internet outages via an IndexedDB offline sales queue with idempotent UUID synchronization and explicit inventory conflict resolution, while guaranteeing zero floating-point rounding errors through integer-scaled decimal math and historical exchange-rate snapshots.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Public SaaS & Installation Flow**: Visitors can explore the public landing page, transparent tier comparison matrix (`Starter`, `Business`, `Premium`), interactive 9-step Installation Wizard (system check, DB check, migration verification, superadmin provisioning, and lock status), or one-click role switcher / login into seeded accounts.
  2. **Cashier Touch POS & Offline Sync Flow**: Cashiers open a register session with an opening cash balance, search or scan products (via device camera barcode scanner or USB keyboard scanner), select product variants, attach a customer (with loyalty points), apply discounts/service charges, and complete checkout via Cash, Card, Digital Wallet, or Split Payment. When toggled or detected offline, sales are queued in IndexedDB with local receipt generation (`58mm` / `80mm` thermal format) and automatically synchronized via idempotent UUID keys upon reconnection—flagging any stock conflicts for manager review rather than silently overwriting server inventory.
  3. **Inventory Ledger & Purchase Order Flow**: Store managers and owners manage products, categories, brands, variants, units, and barcodes; execute auditable Stock In, Stock Out, Stock Adjustment, and inter-store Stock Transfers; and receive Supplier Purchase Orders with automatic stock ledger updates and expiration tracking.
  4. **Multi-Currency Reports & SaaS Administration Flow**: Owners inspect currency-segregated financial dashboards (`PHP ₱` and `USD $` kept strictly separate unless an explicit snapshot conversion is viewed), export CSV/printable reports, and manage subscriptions. Superadmins oversee tenant isolation, plan pricing, backups, security audit logs, and one-click download of `SMARTPOS-PRODUCTION.zip`.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision Commercial Retail & Enterprise SaaS — clean, utilitarian, high-contrast surfaces built for rapid visual scanning under retail store lighting.
  - *Color Palette & Mood*:
    - **60% Dominant Neutral Canvas**: Crisp Alabaster (`#F8FAFC`) in Light Mode; Deep Obsidian Slate (`#0B0F19`) in Dark Mode.
    - **30% Structural Surfaces**: Pure White (`#FFFFFF`) with `1px solid #E2E8F0` hairline dividers in Light Mode; Elevated Slate (`#111827`) with `1px solid #1E293B` borders in Dark Mode.
    - **10% Accent & Semantic Budget**: Royal Cobalt (`#2563EB` / `#3B82F6`) for primary CTAs and active POS controls; Emerald (`#16A34A`) for completed sales and nominal stock; Amber (`#D97706`) for low-stock and pending offline sync; Crimson (`#DC2626`) for voids, refunds, and stock conflicts. Every status pairs color with explicit text/iconography.
  - *Typography & Hierarchy*:
    - **Display & Navigation**: `Plus Jakarta Sans` (SemiBold/Bold 600–700, `text-wrap: balance`) for crisp structural headers.
    - **Body & Controls**: `DM Sans` (Regular/Medium 400–500) for high-legibility labels and touch buttons.
    - **Financials, Barcodes, SKUs & Quantities**: `JetBrains Mono` with mandatory `tabular-nums` (`font-variant-numeric: tabular-nums`) so currency columns, register balances, and receipt line items align to the pixel.
  - *Component Styling & Layout*:
    - Full `1440px` desktop workspace with a `260px` collapsible navigation sidebar, clean 3-zone header bar (including the mandatory `PWAInstallButton` and connectivity/sync status), and responsive mobile bottom tab bar (`≤ 15%` viewport sticky cap).
    - Touch targets strictly `≥ 44×44px` (`48×48px` for primary POS numpad and checkout triggers).
    - Zero static pill enclosures on metadata: SKUs, categories, and timestamps render as clean unboxed text separated by `·` or `/`. Single-level card elevation (`border` without nested card-in-card clutter or thick left accent borders).

- **Interactive Feedback & Motion**:
  - Instant `< 150ms` tactile button press feedback (`active:scale-[0.98]`) on POS product tiles and numpad keys.
  - Real-time offline/online indicator banner with interactive "Simulate Offline Mode" toggle so evaluators can test IndexedDB offline queuing, retry, and conflict detection on demand.
  - Modal receipt preview supporting 58mm thermal, 80mm thermal, and full-page printable invoice layouts.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Exact Decimal Financial Arithmetic & Multi-Currency Separation**
  - *Chosen Approach*: Store and compute all monetary values using exact integer-scaled cents/centavos (`BigInt` / integer math rounded via half-up rules) formatted as `DECIMAL(15,4)` equivalents, storing `currency_code` (`PHP` or `USD`) and `exchange_rate_snapshot` on every transaction.
  - *Why*: Eliminates IEEE-754 floating-point errors (`0.1 + 0.2 !== 0.3`) and prevents historical revenue distortion when exchange rates fluctuate. Reports keep `PHP (₱)` and `USD ($)` totals segregated unless an explicit snapshot report is requested.
  - *Alternatives Considered*: Standard JavaScript `Number` floats or dynamic runtime currency conversion, which violate accounting integrity.

- **Decision 2: Idempotent Offline-First Sync with Non-Destructive Conflict Resolution**
  - *Chosen Approach*: Client-generated `UUIDv4` (`client_transaction_uuid`) stored in IndexedDB (`smartpos_offline_db`) alongside cached catalog items. When syncing to `/api/pos/sync`, the backend processes each sale inside an ACID database transaction with idempotency verification. If an item's server stock fell below the offline sale quantity while offline, the sale is recorded with a `CONFLICT_FLAGGED` stock audit entry for manager resolution rather than silently failing or blindly overwriting ledger adjustments.
  - *Why*: Retail cashiers cannot lose a completed customer payment when Wi-Fi drops, nor can managers lose visibility into negative stock discrepancies.

- **Decision 3: Multi-Tenant Isolation & Complete Laravel 13 Deliverable Archive**
  - *Chosen Approach*: Every tenant-owned record carries `tenant_id` enforced by backend authentication/tenant middleware (`preventing IDOR and cross-tenant access`), while a dedicated server generator builds and serves `SMARTPOS-PRODUCTION.zip` containing the complete Laravel 13 PHP 8.3 codebase, MySQL 8+ migrations, seeders, PHPUnit tests, and deployment guides.
  - *Why*: Gives the user both an immediately testable, feature-complete cloud POS SaaS in the live preview and a downloadable Laravel 13 production repository ready for VPS / Laravel Cloud deployment.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        SMARTPOS CLIENT (React 19 + Vite PWA)                        │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌───────────────────────────────┐  │
│  │ Public & Wizard  │  │  Touch POS Terminal  │  │  Tenant & Platform Consoles   │  │
│  │ • Landing/Pricing│  │ • Barcode / Camera   │  │ • Owner Analytics & Reports   │  │
│  │ • 9-Step Install │  │ • Cart / Hold / Split│  │ • Inventory & Stock Ledger    │  │
│  │ • Role Login     │  │ • 58mm/80mm Receipts │  │ • Purchase Orders & Suppliers │  │
│  │ • PWA Install UI │  │ • Cash Register Ops  │  │ • Superadmin & ZIP Packager   │  │
│  └────────┬─────────┘  └──────────┬───────────┘  └───────────────┬───────────────┘  │
│           │                       │                              │                  │
│           ▼                       ▼                              ▼                  │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │         Offline-First Sync Engine (Service Worker + IndexedDB Store)          │  │
│  │  • Catalog Cache   • Offline Sales Queue (UUID)   • Conflict & Retry Manager  │  │
│  └───────────────────────────────────────┬───────────────────────────────────────┘  │
└──────────────────────────────────────────┼──────────────────────────────────────────┘
                                           │ HTTPS REST API (Bearer + Tenant Context)
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                     SMARTPOS SERVER (Express + TypeScript API)                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │   Security & Tenant Isolation Middleware (RBAC, Rate Limit, IDOR Guard, CSRF) │  │
│  └──────┬─────────────────────────┬──────────────────────────┬───────────────────┘  │
│         ▼                         ▼                          ▼                      │
│  ┌─────────────┐          ┌───────────────┐          ┌───────────────────────────┐  │
│  │ POS & Sync  │          │ Inventory &   │          │ SaaS Billing, Backups &   │  │
│  │ Controller  │          │ Ledger Engine │          │ Laravel 13 ZIP Generator  │  │
│  └──────┬──────┘          └───────┬───────┘          └─────────────┬─────────────┘  │
│         └─────────────────────────┼────────────────────────────────┘                │
│                                   ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │       Transactional Relational Database (SQLite / MySQL 8+ Schema Parity)     │  │
│  │  • tenants, users, roles, stores, warehouses, terminals, business_settings    │  │
│  │  • products, variants, categories, brands, units, barcodes, inventory_ledger  │  │
│  │  • sales, sale_items, payments, refunds, cash_register_sessions, movements    │  │
│  │  • customers, suppliers, purchase_orders, currencies, exchange_rates          │  │
│  │  • subscription_plans, subscriptions, invoices, offline_sync_logs, audit_logs │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Tenant & Identity Core**: `tenants`, `users`, `roles` (`SUPERADMIN`, `BUSINESS_OWNER`, `STORE_MANAGER`, `CASHIER`), `permissions`, `stores`, `warehouses`, `terminals`, `business_settings`. Every tenant resource is strictly scoped by `tenant_id`.
  - **Product & Auditable Inventory Ledger**: `products`, `product_variants`, `categories`, `brands`, `units`, `barcodes`, `inventory` (per store/warehouse stock level, minimum/reorder thresholds, expiration date), `inventory_movements` (immutable ledger recording `SALE`, `STOCK_IN`, `STOCK_OUT`, `ADJUSTMENT`, `TRANSFER`, `REFUND`, `OFFLINE_CONFLICT` with before/after quantities and user attribution), `stock_transfers`, `suppliers`, `purchase_orders`, `purchase_order_items`.
  - **POS, Multi-Currency & Cash Register**: `currencies` (`PHP`, `USD`), `exchange_rates`, `customers` (loyalty points, balances), `cash_registers`, `cash_register_sessions` (opening balance, cash sales, deposits, withdrawals, refunds, expected vs. actual closing balance, variance), `sales` (`transaction_number`, `client_uuid` idempotency key, `currency_code`, `exchange_rate_snapshot`, `subtotal`, `discount_total`, `tax_total`, `service_charge`, `grand_total`, `cogs_total`, `sync_status`), `sale_items`, `payments` (Cash, Card, Bank Transfer, Digital Wallet, Split with provider references), `refunds`.
  - **SaaS Billing, Sync & Security Operations**: `subscription_plans`, `subscriptions`, `subscription_invoices`, `payment_webhooks`, `offline_sync_logs`, `audit_logs`, `system_backups`.

- **Interactive Component & State Mapping**:
  - **Role & Tenant Switcher / Auth**: Authenticates against `/api/auth/login` or instant demo role switch, loading tenant-scoped stores, permissions, and active register session.
  - **POS Terminal Workspace**: Supports live search, category filtering, barcode input (keyboard wedge listener + HTML5 camera barcode scanner modal), variant picker, cart quantity/discount/tax/service-charge calculations, hold & resume orders in local state/IndexedDB, split-tender payment modal, and thermal receipt modal (`58mm` / `80mm` / PDF print).
  - **Offline Sync & Conflict Center**: Tracks `navigator.onLine` plus manual offline simulation mode; queues offline sales in IndexedDB with `UUIDv4`; auto-syncs to `/api/pos/sync` when online; displays sync history and lets managers resolve any flagged inventory conflicts.
  - **Inventory, Suppliers & Purchase Orders**: Full CRUD forms with validation for creating/editing products, printing/scanning barcodes, recording stock adjustments/transfers, and creating/receiving supplier purchase orders.
  - **Cash Register Drawer**: Interactive Open Register, Cash Deposit/Withdrawal, and Close Register reconciliation workflow calculating expected vs. actual cash variance.
  - **Reports, Installation Wizard & Laravel 13 ZIP Export**: Interactive date/store/currency filters, CSV export, printable reports, 9-step Installation Wizard health check, database backup & verification runner, automated test runner suite in UI, and `/api/export/laravel-zip` generating `SMARTPOS-PRODUCTION.zip`.
