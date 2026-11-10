import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { toCents, fromCents, addDecimal, subDecimal, mulDecimal, calcPercentage } from '../utils/decimal.ts';

const dbPath = path.resolve(process.cwd(), 'smartpos.sqlite');
export const db = new Database(dbPath);

// Enable WAL mode and foreign keys for transactional concurrency and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`smartpos_salt_v1_${password}`).digest('hex');
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS installation_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_installed INTEGER NOT NULL DEFAULT 1,
      installed_at TEXT NOT NULL,
      app_name TEXT NOT NULL DEFAULT 'SMARTPOS Cloud',
      app_env TEXT NOT NULL DEFAULT 'production',
      app_version TEXT NOT NULL DEFAULT '1.0.0',
      lock_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS currencies (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      decimal_precision INTEGER NOT NULL DEFAULT 2,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_currency TEXT NOT NULL,
      target_currency TEXT NOT NULL,
      rate TEXT NOT NULL,
      effective_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      monthly_price_usd TEXT NOT NULL,
      annual_price_usd TEXT NOT NULL,
      monthly_price_php TEXT NOT NULL,
      annual_price_php TEXT NOT NULL,
      max_stores INTEGER NOT NULL,
      max_users INTEGER NOT NULL,
      max_products INTEGER NOT NULL,
      features_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      business_type TEXT NOT NULL,
      tax_id_tin TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      primary_currency TEXT NOT NULL DEFAULT 'PHP',
      allow_negative_stock INTEGER NOT NULL DEFAULT 0,
      default_tax_rate TEXT NOT NULL DEFAULT '12.00',
      default_service_charge_rate TEXT NOT NULL DEFAULT '0.00',
      receipt_header TEXT NOT NULL DEFAULT 'Thank you for shopping with us!',
      receipt_footer TEXT NOT NULL DEFAULT 'Official Receipt · VAT Registered · Keep receipt for returns within 7 days.',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      plan_code TEXT NOT NULL DEFAULT 'BUSINESS',
      billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
      subscription_status TEXT NOT NULL DEFAULT 'ACTIVE',
      trial_ends_at TEXT,
      current_period_ends_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      permissions_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER,
      assigned_store_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_code TEXT NOT NULL,
      pin_code TEXT NOT NULL DEFAULT '1234',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      default_currency TEXT NOT NULL DEFAULT 'PHP',
      tax_rate TEXT NOT NULL DEFAULT '12.00',
      is_warehouse INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      UNIQUE(tenant_id, code),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS terminals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      device_type TEXT NOT NULL DEFAULT 'Touch Tablet / Web PWA',
      printer_profile TEXT NOT NULL DEFAULT '80mm',
      is_active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(tenant_id, code),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      UNIQUE(tenant_id, slug),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      short_code TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      brand_id INTEGER,
      unit_id INTEGER,
      sku TEXT NOT NULL,
      barcode TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      currency_code TEXT NOT NULL DEFAULT 'PHP',
      cost_price TEXT NOT NULL,
      selling_price TEXT NOT NULL,
      wholesale_price TEXT NOT NULL,
      cost_price_usd TEXT NOT NULL DEFAULT '0.00',
      selling_price_usd TEXT NOT NULL DEFAULT '0.00',
      tax_exempt INTEGER NOT NULL DEFAULT 0,
      track_inventory INTEGER NOT NULL DEFAULT 1,
      expiration_date TEXT,
      variants_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(tenant_id, sku),
      UNIQUE(tenant_id, barcode),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      min_stock_level INTEGER NOT NULL DEFAULT 10,
      reorder_level INTEGER NOT NULL DEFAULT 20,
      updated_at TEXT NOT NULL,
      UNIQUE(tenant_id, store_id, product_id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      quantity_before INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      unit_cost TEXT NOT NULL DEFAULT '0.00',
      reference_type TEXT NOT NULL,
      reference_number TEXT NOT NULL,
      notes TEXT,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      loyalty_points INTEGER NOT NULL DEFAULT 0,
      discount_rate TEXT NOT NULL DEFAULT '0.00',
      credit_balance_php TEXT NOT NULL DEFAULT '0.00',
      credit_balance_usd TEXT NOT NULL DEFAULT '0.00',
      total_spent_php TEXT NOT NULL DEFAULT '0.00',
      total_spent_usd TEXT NOT NULL DEFAULT '0.00',
      created_at TEXT NOT NULL,
      UNIQUE(tenant_id, code),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      balance_php TEXT NOT NULL DEFAULT '0.00',
      created_at TEXT NOT NULL,
      UNIQUE(tenant_id, code),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      po_number TEXT NOT NULL,
      currency_code TEXT NOT NULL DEFAULT 'PHP',
      total_amount TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ORDERED',
      items_json TEXT NOT NULL,
      notes TEXT,
      created_by_user_id INTEGER NOT NULL,
      received_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(tenant_id, po_number),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cash_register_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      terminal_id INTEGER NOT NULL,
      opened_by_user_id INTEGER NOT NULL,
      closed_by_user_id INTEGER,
      currency_code TEXT NOT NULL DEFAULT 'PHP',
      opening_balance TEXT NOT NULL,
      cash_sales_total TEXT NOT NULL DEFAULT '0.00',
      cash_deposits_total TEXT NOT NULL DEFAULT '0.00',
      cash_withdrawals_total TEXT NOT NULL DEFAULT '0.00',
      cash_refunds_total TEXT NOT NULL DEFAULT '0.00',
      expected_closing_balance TEXT NOT NULL DEFAULT '0.00',
      actual_closing_balance TEXT,
      variance_amount TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      notes TEXT,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount TEXT NOT NULL,
      currency_code TEXT NOT NULL DEFAULT 'PHP',
      reason TEXT NOT NULL,
      created_by_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES cash_register_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      terminal_id INTEGER NOT NULL,
      register_session_id INTEGER,
      cashier_user_id INTEGER NOT NULL,
      customer_id INTEGER,
      transaction_number TEXT NOT NULL,
      client_uuid TEXT NOT NULL,
      currency_code TEXT NOT NULL DEFAULT 'PHP',
      exchange_rate_snapshot TEXT NOT NULL DEFAULT '58.50',
      subtotal TEXT NOT NULL,
      discount_total TEXT NOT NULL DEFAULT '0.00',
      tax_rate_snapshot TEXT NOT NULL DEFAULT '12.00',
      tax_total TEXT NOT NULL DEFAULT '0.00',
      service_charge TEXT NOT NULL DEFAULT '0.00',
      grand_total TEXT NOT NULL,
      cogs_total TEXT NOT NULL DEFAULT '0.00',
      profit_total TEXT NOT NULL DEFAULT '0.00',
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'PAID',
      amount_tendered TEXT NOT NULL,
      change_amount TEXT NOT NULL DEFAULT '0.00',
      payments_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      sync_source TEXT NOT NULL DEFAULT 'ONLINE',
      has_inventory_conflict INTEGER NOT NULL DEFAULT 0,
      conflict_notes TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(tenant_id, transaction_number),
      UNIQUE(tenant_id, client_uuid),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      variant_name TEXT,
      quantity INTEGER NOT NULL,
      unit_cost_snapshot TEXT NOT NULL,
      unit_price_snapshot TEXT NOT NULL,
      discount_amount TEXT NOT NULL DEFAULT '0.00',
      tax_amount TEXT NOT NULL DEFAULT '0.00',
      line_total TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL,
      refund_number TEXT NOT NULL,
      currency_code TEXT NOT NULL,
      amount TEXT NOT NULL,
      reason TEXT NOT NULL,
      restock_items INTEGER NOT NULL DEFAULT 1,
      processed_by_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscription_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL UNIQUE,
      plan_code TEXT NOT NULL,
      billing_cycle TEXT NOT NULL,
      currency_code TEXT NOT NULL,
      amount TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAID',
      provider_ref TEXT NOT NULL,
      paid_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS offline_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      client_uuid TEXT NOT NULL,
      transaction_number TEXT NOT NULL,
      sync_status TEXT NOT NULL,
      conflict_detected INTEGER NOT NULL DEFAULT 0,
      conflict_resolution TEXT,
      payload_summary TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER,
      user_id INTEGER,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      tables_count INTEGER NOT NULL,
      records_count INTEGER NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 1,
      storage_driver TEXT NOT NULL DEFAULT 'local-encrypted + s3-ready',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM tenants').get() as { cnt: number };
  if (existing.cnt > 0) return;

  const now = new Date().toISOString();

  // Installation lock state
  db.prepare(`
    INSERT OR IGNORE INTO installation_state (id, is_installed, installed_at, app_name, app_env, app_version, lock_hash)
    VALUES (1, 1, ?, 'SMARTPOS Cloud SaaS', 'production', '1.0.0', ?)
  `).run(now, crypto.createHash('sha256').update('smartpos_installed_lock_v1').digest('hex'));

  // Currencies
  db.prepare(`INSERT INTO currencies (code, name, symbol, decimal_precision, is_active, created_at) VALUES (?, ?, ?, 2, 1, ?)`).run('PHP', 'Philippine Peso', '₱', now);
  db.prepare(`INSERT INTO currencies (code, name, symbol, decimal_precision, is_active, created_at) VALUES (?, ?, ?, 2, 1, ?)`).run('USD', 'US Dollar', '$', now);

  // Exchange rates
  db.prepare(`INSERT INTO exchange_rates (base_currency, target_currency, rate, effective_at) VALUES ('USD', 'PHP', '58.50', ?)`).run(now);
  db.prepare(`INSERT INTO exchange_rates (base_currency, target_currency, rate, effective_at) VALUES ('PHP', 'USD', '0.0171', ?)`).run(now);

  // Subscription plans
  const insertPlan = db.prepare(`
    INSERT INTO subscription_plans (code, name, tagline, monthly_price_usd, annual_price_usd, monthly_price_php, annual_price_php, max_stores, max_users, max_products, features_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPlan.run(
    'STARTER',
    'Starter Plan',
    'For single-location boutique shops & cafes',
    '9.00',
    '90.00',
    '526.50',
    '5265.00',
    1,
    3,
    250,
    JSON.stringify(['1 Store & 1 Register Terminal', 'Basic POS & Thermal Receipts', 'Core Inventory Ledger', 'Standard Daily Sales Reports', 'Offline POS Queue'])
  );
  insertPlan.run(
    'BUSINESS',
    'Business Plan',
    'For growing multi-cashier retail operations',
    '19.00',
    '190.00',
    '1111.50',
    '11115.00',
    3,
    15,
    2500,
    JSON.stringify(['Up to 3 Stores & Warehouses', 'Multi-Currency (PHP & USD)', 'Purchase Orders & Suppliers', 'Customer Loyalty & Credit Ledger', 'COGS & Profit Margin Analytics'])
  );
  insertPlan.run(
    'PREMIUM',
    'Premium Enterprise',
    'For multi-branch franchises & high-volume chains',
    '39.00',
    '390.00',
    '2281.50',
    '22815.00',
    25,
    100,
    50000,
    JSON.stringify(['Up to 25 Stores & Warehouses', 'Granular RBAC & Audit Trail', 'Automated Conflict Resolution', 'REST API & Webhook Integrations', 'Priority 24/7 SLA & Backups'])
  );

  // Roles
  const insertRole = db.prepare(`INSERT INTO roles (code, name, description, permissions_json) VALUES (?, ?, ?, ?)`);
  insertRole.run('SUPERADMIN', 'Platform Superadmin', 'Full SaaS platform administration across all tenants', JSON.stringify(['*']));
  insertRole.run('BUSINESS_OWNER', 'Business Owner', 'Full tenant access: stores, staff, inventory, reports, billing', JSON.stringify(['pos.*', 'inventory.*', 'reports.*', 'settings.*', 'billing.*', 'users.*']));
  insertRole.run('STORE_MANAGER', 'Store Manager', 'Manage assigned store, inventory adjustments, registers, and store reports', JSON.stringify(['pos.*', 'inventory.*', 'reports.store', 'register.*']));
  insertRole.run('CASHIER', 'Cashier', 'Operate POS terminal, process sales, print receipts, open/close cash drawer', JSON.stringify(['pos.sell', 'pos.hold', 'pos.discount', 'register.session']));

  // Tenants (2 separate tenants to prove and test strict multi-tenant isolation)
  const insertTenant = db.prepare(`
    INSERT INTO tenants (uuid, name, slug, business_type, tax_id_tin, email, phone, address, primary_currency, allow_negative_stock, default_tax_rate, default_service_charge_rate, status, plan_code, billing_cycle, subscription_status, current_period_ends_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 'MONTHLY', 'ACTIVE', ?, ?, ?)
  `);

  const periodEnd = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
  const t1 = insertTenant.run(
    crypto.randomUUID(),
    'Aurora Specialty Coffee & Roastery',
    'aurora-coffee',
    'Specialty Retail & Cafe',
    'TIN-009-482-119-000',
    'owner@auroracoffee.ph',
    '+63 917 555 0192',
    '142 Legazpi Village, Makati City, Metro Manila, Philippines',
    'PHP',
    0,
    '12.00',
    '5.00',
    'PREMIUM',
    periodEnd,
    now,
    now
  );
  const tenant1Id = Number(t1.lastInsertRowid);

  const t2 = insertTenant.run(
    crypto.randomUUID(),
    'Pacific Horizon Electronics Co.',
    'pacific-horizon',
    'Consumer Electronics & Accessories',
    'EIN-94-3829104',
    'founder@pacifichorizon.io',
    '+1 (415) 890-4321',
    '740 Market Street, Suite 400, San Francisco, CA',
    'USD',
    0,
    '8.25',
    '0.00',
    'BUSINESS',
    periodEnd,
    now,
    now
  );
  const tenant2Id = Number(t2.lastInsertRowid);

  // Stores for Tenant 1
  const insertStore = db.prepare(`
    INSERT INTO stores (tenant_id, code, name, address, phone, default_currency, tax_rate, is_warehouse, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
  `);
  const s1 = insertStore.run(tenant1Id, 'MKT-01', 'Makati Flagship Store', '142 Legazpi Village, Makati City', '+63 2 8812 4410', 'PHP', '12.00', 0, now);
  const s2 = insertStore.run(tenant1Id, 'BGC-02', 'BGC High Street Branch', 'Bonifacio High Street, Taguig City', '+63 2 8845 9921', 'PHP', '12.00', 0, now);
  const s3 = insertStore.run(tenant1Id, 'WH-CENTRAL', 'Central Roastery Warehouse', 'Pasig Industrial Park, Metro Manila', '+63 2 8631 1002', 'PHP', '12.00', 1, now);
  const store1Id = Number(s1.lastInsertRowid);
  const store2Id = Number(s2.lastInsertRowid);
  const warehouse1Id = Number(s3.lastInsertRowid);

  // Store for Tenant 2
  const s4 = insertStore.run(tenant2Id, 'SFO-01', 'San Francisco Downtown Store', '740 Market St, San Francisco, CA', '+1 415 890 4321', 'USD', '8.25', 0, now);
  const tenant2StoreId = Number(s4.lastInsertRowid);

  // Terminals
  const insertTerminal = db.prepare(`
    INSERT INTO terminals (tenant_id, store_id, code, name, device_type, printer_profile, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  const term1 = insertTerminal.run(tenant1Id, store1Id, 'POS-MKT-01', 'Front Counter Touch POS #1', 'Touchscreen Tablet / USB Scanner', '80mm');
  insertTerminal.run(tenant1Id, store1Id, 'POS-MKT-02', 'Espresso Bar Mobile POS #2', 'Mobile Handheld PWA / Camera', '58mm');
  insertTerminal.run(tenant1Id, store2Id, 'POS-BGC-01', 'BGC Main Counter POS #1', 'Touchscreen Tablet', '80mm');
  const terminal1Id = Number(term1.lastInsertRowid);

  insertTerminal.run(tenant2Id, tenant2StoreId, 'POS-SFO-01', 'SF Main Register #1', 'Desktop Touch Terminal', '80mm');

  // Users (Superadmin + Tenant 1 Owner, Manager, Cashier + Tenant 2 Owner)
  const insertUser = db.prepare(`
    INSERT INTO users (tenant_id, assigned_store_id, name, email, password_hash, role_code, pin_code, status, last_login_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  `);
  insertUser.run(null, null, 'Elena Vance (Platform Superadmin)', 'superadmin@smartpos.io', hashPassword('Admin@12345'), 'SUPERADMIN', '9999', now, now);
  const uOwner = insertUser.run(tenant1Id, store1Id, 'Marco Santos (Business Owner)', 'owner@auroracoffee.ph', hashPassword('Owner@12345'), 'BUSINESS_OWNER', '1111', now, now);
  const uManager = insertUser.run(tenant1Id, store1Id, 'Clara Reyes (Store Manager)', 'manager@auroracoffee.ph', hashPassword('Manager@12345'), 'STORE_MANAGER', '2222', now, now);
  const uCashier = insertUser.run(tenant1Id, store1Id, 'Liam Cruz (Senior Cashier)', 'cashier@auroracoffee.ph', hashPassword('Cashier@12345'), 'CASHIER', '3333', now, now);
  insertUser.run(tenant2Id, tenant2StoreId, 'David Chen (Pacific Owner)', 'founder@pacifichorizon.io', hashPassword('Owner@12345'), 'BUSINESS_OWNER', '4444', now, now);

  const ownerId = Number(uOwner.lastInsertRowid);
  const managerId = Number(uManager.lastInsertRowid);
  const cashierId = Number(uCashier.lastInsertRowid);

  // Categories, Brands, Units for Tenant 1
  const insertCat = db.prepare(`INSERT INTO categories (tenant_id, name, slug, description) VALUES (?, ?, ?, ?)`);
  const catCoffee = Number(insertCat.run(tenant1Id, 'Specialty Coffee & Beans', 'specialty-coffee', 'Whole bean & freshly brewed espresso beverages').lastInsertRowid);
  const catMatcha = Number(insertCat.run(tenant1Id, 'Ceremonial Tea & Matcha', 'ceremonial-tea', 'Uji matcha tins and botanical infusions').lastInsertRowid);
  const catPastry = Number(insertCat.run(tenant1Id, 'Artisan Bakery & Pastries', 'artisan-bakery', 'Daily baked laminated pastries and sourdough').lastInsertRowid);
  const catGear = Number(insertCat.run(tenant1Id, 'Brewing Equipment & Merch', 'brewing-gear', 'Pour-over drippers, scales, and thermal tumblers').lastInsertRowid);

  const insertBrand = db.prepare(`INSERT INTO brands (tenant_id, name) VALUES (?, ?)`);
  const brandAurora = Number(insertBrand.run(tenant1Id, 'Aurora Roasters').lastInsertRowid);
  const brandNishi = Number(insertBrand.run(tenant1Id, 'Nishi Uji Tea').lastInsertRowid);
  const brandAtelier = Number(insertBrand.run(tenant1Id, 'Atelier Boulangerie').lastInsertRowid);

  const insertUnit = db.prepare(`INSERT INTO units (tenant_id, name, short_code) VALUES (?, ?, ?)`);
  const unitBag = Number(insertUnit.run(tenant1Id, 'Bag (340g)', 'bag').lastInsertRowid);
  const unitTin = Number(insertUnit.run(tenant1Id, 'Tin (40g)', 'tin').lastInsertRowid);
  const unitPc = Number(insertUnit.run(tenant1Id, 'Piece', 'pc').lastInsertRowid);
  const unitCup = Number(insertUnit.run(tenant1Id, 'Serving Cup', 'cup').lastInsertRowid);

  // Products for Tenant 1 (with real generated images & realistic PHP + USD prices)
  const insertProduct = db.prepare(`
    INSERT INTO products (
      tenant_id, category_id, brand_id, unit_id, sku, barcode, name, description, image_url,
      currency_code, cost_price, selling_price, wholesale_price, cost_price_usd, selling_price_usd,
      tax_exempt, track_inventory, expiration_date, variants_json, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PHP', ?, ?, ?, ?, ?, 0, 1, ?, ?, 1, ?, ?)
  `);

  const productsSeed = [
    {
      cat: catCoffee,
      brand: brandAurora,
      unit: unitBag,
      sku: 'AUR-ESP-340',
      barcode: '4800192837410',
      name: 'Dark Matter Espresso Whole Bean (340g)',
      desc: 'Single-origin Brazil & Colombia dark chocolate and roasted almond notes.',
      img: '/src/assets/images/product_espresso_blend_1794314139623.jpg',
      cost: '380.00',
      price: '680.00',
      wholesale: '560.00',
      costUsd: '6.50',
      priceUsd: '11.62',
      exp: '2027-06-30',
      variants: [{ name: 'Whole Bean', priceDelta: '0.00' }, { name: 'Fine Espresso Grind', priceDelta: '0.00' }, { name: 'V60 Filter Grind', priceDelta: '0.00' }],
      stockMkt: 48,
      stockBgc: 32,
      stockWh: 140,
      min: 15,
    },
    {
      cat: catMatcha,
      brand: brandNishi,
      unit: unitTin,
      sku: 'NSH-MTC-040',
      barcode: '4800192837427',
      name: 'Nishi Uji Ceremonial Matcha Tin (40g)',
      desc: 'First-harvest stone-milled Uji Kyoto ceremonial grade green tea.',
      img: '/src/assets/images/product_matcha_tin_1794314140888.jpg',
      cost: '520.00',
      price: '950.00',
      wholesale: '790.00',
      costUsd: '8.89',
      priceUsd: '16.24',
      exp: '2027-04-15',
      variants: [{ name: '40g Standard Tin', priceDelta: '0.00' }, { name: 'Gift Boxed Tin', priceDelta: '120.00' }],
      stockMkt: 26,
      stockBgc: 18,
      stockWh: 75,
      min: 10,
    },
    {
      cat: catPastry,
      brand: brandAtelier,
      unit: unitPc,
      sku: 'ATL-CRS-001',
      barcode: '4800192837434',
      name: 'Artisan Cultured Butter Croissant',
      desc: 'French Isigny butter laminated pastry baked fresh every morning.',
      img: '/src/assets/images/product_artisan_pastry_1794314139706.jpg',
      cost: '65.00',
      price: '165.00',
      wholesale: '135.00',
      costUsd: '1.11',
      priceUsd: '2.82',
      exp: '2026-11-15',
      variants: [{ name: 'Warm Classic', priceDelta: '0.00' }, { name: 'With House Jam & Butter', priceDelta: '35.00' }],
      stockMkt: 19,
      stockBgc: 14,
      stockWh: 0,
      min: 12,
    },
    {
      cat: catCoffee,
      brand: brandAurora,
      unit: unitCup,
      sku: 'AUR-LAT-012',
      barcode: '4800192837441',
      name: 'Signature Spanish Oat Cortado (12oz)',
      desc: 'Double ristretto pulled over velvety condensed oat milk.',
      img: '/src/assets/images/product_espresso_blend_1794314139623.jpg',
      cost: '72.00',
      price: '210.00',
      wholesale: '190.00',
      costUsd: '1.23',
      priceUsd: '3.59',
      exp: '2027-12-31',
      variants: [{ name: 'Hot 12oz', priceDelta: '0.00' }, { name: 'Iced 16oz', priceDelta: '25.00' }, { name: 'Extra Espresso Shot', priceDelta: '45.00' }],
      stockMkt: 85,
      stockBgc: 60,
      stockWh: 0,
      min: 20,
    },
    {
      cat: catMatcha,
      brand: brandNishi,
      unit: unitCup,
      sku: 'NSH-WHT-016',
      barcode: '4800192837458',
      name: 'Kyoto Uji Matcha Cloud Latte (16oz)',
      desc: 'Whisked ceremonial matcha with cold-foam sea salt cream.',
      img: '/src/assets/images/product_matcha_tin_1794314140888.jpg',
      cost: '85.00',
      price: '235.00',
      wholesale: '200.00',
      costUsd: '1.45',
      priceUsd: '4.02',
      exp: '2027-12-31',
      variants: [{ name: 'Iced 16oz', priceDelta: '0.00' }, { name: 'Oat Milk Upgrade', priceDelta: '30.00' }],
      stockMkt: 64,
      stockBgc: 42,
      stockWh: 0,
      min: 15,
    },
    {
      cat: catPastry,
      brand: brandAtelier,
      unit: unitPc,
      sku: 'ATL-PDC-002',
      barcode: '4800192837465',
      name: 'Valrhona 70% Pain au Chocolat',
      desc: 'Flaky sourdough-hybrid pastry with two batons of dark Valrhona chocolate.',
      img: '/src/assets/images/product_artisan_pastry_1794314139706.jpg',
      cost: '78.00',
      price: '195.00',
      wholesale: '155.00',
      costUsd: '1.33',
      priceUsd: '3.33',
      exp: '2026-11-15',
      variants: [{ name: 'Standard', priceDelta: '0.00' }],
      stockMkt: 7, // Intentionally low stock to showcase Low-Stock Alert
      stockBgc: 15,
      stockWh: 0,
      min: 12,
    },
    {
      cat: catGear,
      brand: brandAurora,
      unit: unitPc,
      sku: 'AUR-TMB-500',
      barcode: '4800192837472',
      name: 'Matte Obsidian Vacuum Travel Tumbler (500ml)',
      desc: 'Double-wall 316 stainless steel thermal carafe for hot and cold brews.',
      img: '/src/assets/images/product_espresso_blend_1794314139623.jpg',
      cost: '620.00',
      price: '1250.00',
      wholesale: '990.00',
      costUsd: '10.60',
      priceUsd: '21.37',
      exp: null,
      variants: [{ name: 'Obsidian Black', priceDelta: '0.00' }, { name: 'Brushed Steel', priceDelta: '0.00' }],
      stockMkt: 9, // Low stock alert
      stockBgc: 11,
      stockWh: 45,
      min: 10,
    },
    {
      cat: catCoffee,
      brand: brandAurora,
      unit: unitBag,
      sku: 'AUR-ETH-250',
      barcode: '4800192837489',
      name: 'Ethiopia Yirgacheffe Washed Filter (250g)',
      desc: 'Bergamot, jasmine blossom, and white peach clarity.',
      img: '/src/assets/images/product_espresso_blend_1794314139623.jpg',
      cost: '410.00',
      price: '740.00',
      wholesale: '610.00',
      costUsd: '7.01',
      priceUsd: '12.65',
      exp: '2027-07-20',
      variants: [{ name: 'Whole Bean', priceDelta: '0.00' }, { name: 'Pour-Over Grind', priceDelta: '0.00' }],
      stockMkt: 31,
      stockBgc: 22,
      stockWh: 90,
      min: 10,
    },
  ];

  const insertInv = db.prepare(`
    INSERT INTO inventory (tenant_id, store_id, product_id, stock_quantity, min_stock_level, reorder_level, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMove = db.prepare(`
    INSERT INTO inventory_movements (tenant_id, store_id, product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, reference_type, reference_number, notes, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const productIds: number[] = [];
  for (const p of productsSeed) {
    const res = insertProduct.run(
      tenant1Id,
      p.cat,
      p.brand,
      p.unit,
      p.sku,
      p.barcode,
      p.name,
      p.desc,
      p.img,
      p.cost,
      p.price,
      p.wholesale,
      p.costUsd,
      p.priceUsd,
      p.exp,
      JSON.stringify(p.variants),
      now,
      now
    );
    const pid = Number(res.lastInsertRowid);
    productIds.push(pid);

    insertInv.run(tenant1Id, store1Id, pid, p.stockMkt, p.min, p.min * 2, now);
    insertInv.run(tenant1Id, store2Id, pid, p.stockBgc, p.min, p.min * 2, now);
    insertInv.run(tenant1Id, warehouse1Id, pid, p.stockWh, p.min * 2, p.min * 4, now);

    insertMove.run(tenant1Id, store1Id, pid, 'STOCK_IN', p.stockMkt, 0, p.stockMkt, p.cost, 'INITIAL_SEED', 'INIT-2026-001', 'Opening physical inventory count', ownerId, now);
  }

  // Seed Tenant 2 Product to demonstrate strict tenant isolation
  const catT2 = Number(insertCat.run(tenant2Id, 'USB-C Hubs & Chargers', 'usbc-hubs', 'GaN fast chargers').lastInsertRowid);
  const pT2 = Number(
    insertProduct.run(
      tenant2Id,
      catT2,
      null,
      null,
      'PH-GAN-100W',
      '8901122334455',
      'Pacific Pro 100W GaN Desktop Charger',
      '4-port USB-C PD 3.1 charger',
      '/src/assets/images/pos_hero_terminal_1794314139858.jpg',
      '45.00',
      '89.00',
      '72.00',
      '45.00',
      '89.00',
      null,
      JSON.stringify([]),
      now,
      now
    ).lastInsertRowid
  );
  insertInv.run(tenant2Id, tenant2StoreId, pT2, 120, 15, 30, now);

  // Customers for Tenant 1
  const insertCustomer = db.prepare(`
    INSERT INTO customers (tenant_id, code, name, email, phone, loyalty_points, discount_rate, credit_balance_php, credit_balance_usd, total_spent_php, total_spent_usd, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const cust1Id = Number(insertCustomer.run(tenant1Id, 'CUST-1001', 'Sofia Lorenzo', 'sofia.lorenzo@gmail.com', '+63 917 821 4401', 420, '5.00', '0.00', '0.00', '8450.00', '42.50', now).lastInsertRowid);
  const cust2Id = Number(insertCustomer.run(tenant1Id, 'CUST-1002', 'Gabriel Villanueva', 'g.villanueva@ayalacorp.ph', '+63 918 339 1102', 890, '10.00', '350.00', '0.00', '19200.00', '118.00', now).lastInsertRowid);
  insertCustomer.run(tenant1Id, 'CUST-1003', 'Hannah Tan-Chua', 'hannah.tanchua@outlook.com', '+63 917 602 9981', 150, '0.00', '0.00', '0.00', '3120.00', '0.00', now);

  // Suppliers for Tenant 1
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (tenant_id, code, name, contact_person, email, phone, address, balance_php, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const sup1Id = Number(insertSupplier.run(tenant1Id, 'SUP-001', 'Highland Cordillera Coffee Growers Co-op', 'Mateo Dalisay', 'supply@cordilleracoop.ph', '+63 917 440 2291', 'La Trinidad, Benguet, Philippines', '18500.00', now).lastInsertRowid);
  const sup2Id = Number(insertSupplier.run(tenant1Id, 'SUP-002', 'Kyoto Uji Tea Importers Inc.', 'Kenji Takahashi', 'orders@ujiteaph.com', '+63 2 8891 3312', 'Chino Roces Ave, Makati City', '0.00', now).lastInsertRowid);

  // Purchase Orders for Tenant 1
  const insertPO = db.prepare(`
    INSERT INTO purchase_orders (tenant_id, store_id, supplier_id, po_number, currency_code, total_amount, status, items_json, notes, created_by_user_id, received_at, created_at)
    VALUES (?, ?, ?, ?, 'PHP', ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPO.run(
    tenant1Id,
    store1Id,
    sup1Id,
    'PO-2026-0041',
    '19000.00',
    'RECEIVED',
    JSON.stringify([{ productId: productIds[0], sku: 'AUR-ESP-340', name: 'Dark Matter Espresso Whole Bean (340g)', quantity: 50, unitCost: '380.00', lineTotal: '19000.00' }]),
    'Monthly espresso roast replenishment',
    ownerId,
    now,
    now
  );
  insertPO.run(
    tenant1Id,
    store1Id,
    sup2Id,
    'PO-2026-0042',
    '15600.00',
    'ORDERED',
    JSON.stringify([{ productId: productIds[1], sku: 'NSH-MTC-040', name: 'Nishi Uji Ceremonial Matcha Tin (40g)', quantity: 30, unitCost: '520.00', lineTotal: '15600.00' }]),
    'Awaiting air freight arrival from Osaka',
    managerId,
    null,
    now
  );

  // Open Cash Register Session for Store 1 Terminal 1
  const insertSession = db.prepare(`
    INSERT INTO cash_register_sessions (
      tenant_id, store_id, terminal_id, opened_by_user_id, currency_code, opening_balance,
      cash_sales_total, cash_deposits_total, cash_withdrawals_total, cash_refunds_total,
      expected_closing_balance, status, notes, opened_at
    ) VALUES (?, ?, ?, ?, 'PHP', '5000.00', '1654.80', '1000.00', '0.00', '0.00', '7654.80', 'OPEN', 'Morning shift register drawer', ?)
  `);
  const session1Id = Number(insertSession.run(tenant1Id, store1Id, terminal1Id, cashierId, now).lastInsertRowid);

  db.prepare(`
    INSERT INTO cash_movements (tenant_id, session_id, type, amount, currency_code, reason, created_by_user_id, created_at)
    VALUES (?, ?, 'DEPOSIT', '1000.00', 'PHP', 'Added PHP 100 & PHP 50 smaller bills for change', ?, ?)
  `).run(tenant1Id, session1Id, cashierId, now);

  // Seed Sample Completed Sales (Both PHP and USD to showcase separated multi-currency reporting)
  const insertSale = db.prepare(`
    INSERT INTO sales (
      tenant_id, store_id, terminal_id, register_session_id, cashier_user_id, customer_id,
      transaction_number, client_uuid, currency_code, exchange_rate_snapshot,
      subtotal, discount_total, tax_rate_snapshot, tax_total, service_charge, grand_total,
      cogs_total, profit_total, payment_method, payment_status, amount_tendered, change_amount,
      payments_json, status, sync_source, has_inventory_conflict, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '58.50', ?, ?, '12.00', ?, ?, ?, ?, ?, ?, 'PAID', ?, ?, ?, 'COMPLETED', ?, 0, ?)
  `);

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (
      tenant_id, sale_id, product_id, sku, product_name, variant_name, quantity,
      unit_cost_snapshot, unit_price_snapshot, discount_amount, tax_amount, line_total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Sale 1: PHP Cash Sale
  const s1Res = insertSale.run(
    tenant1Id,
    store1Id,
    terminal1Id,
    session1Id,
    cashierId,
    cust1Id,
    'OR-2026-10001',
    crypto.randomUUID(),
    'PHP',
    '1477.50',
    '0.00',
    '177.30',
    '0.00',
    '1654.80',
    '792.00',
    '685.50',
    'CASH',
    '2000.00',
    '345.20',
    JSON.stringify([{ method: 'CASH', amount: '1654.80', reference: 'CASH-DRAWER' }]),
    'ONLINE',
    now
  );
  const sale1Id = Number(s1Res.lastInsertRowid);
  insertSaleItem.run(tenant1Id, sale1Id, productIds[0], 'AUR-ESP-340', 'Dark Matter Espresso Whole Bean (340g)', 'Whole Bean', 1, '380.00', '680.00', '0.00', '81.60', '680.00');
  insertSaleItem.run(tenant1Id, sale1Id, productIds[2], 'ATL-CRS-001', 'Artisan Cultured Butter Croissant', 'Warm Classic', 2, '65.00', '165.00', '0.00', '39.60', '330.00');
  insertSaleItem.run(tenant1Id, sale1Id, productIds[4], 'NSH-WHT-016', 'Kyoto Uji Matcha Cloud Latte (16oz)', 'Iced 16oz', 2, '85.00', '233.75', '0.00', '56.10', '467.50');

  // Sale 2: PHP Card Sale
  const s2Res = insertSale.run(
    tenant1Id,
    store1Id,
    terminal1Id,
    session1Id,
    cashierId,
    cust2Id,
    'OR-2026-10002',
    crypto.randomUUID(),
    'PHP',
    '1900.00',
    '190.00',
    '205.20',
    '0.00',
    '1915.20',
    '1040.00',
    '670.00',
    'CARD',
    '1915.20',
    '0.00',
    JSON.stringify([{ method: 'CARD', amount: '1915.20', reference: 'STRIPE-PI-99281A' }]),
    'ONLINE',
    now
  );
  const sale2Id = Number(s2Res.lastInsertRowid);
  insertSaleItem.run(tenant1Id, sale2Id, productIds[1], 'NSH-MTC-040', 'Nishi Uji Ceremonial Matcha Tin (40g)', '40g Standard Tin', 2, '520.00', '950.00', '190.00', '205.20', '1710.00');

  // Sale 3: USD Digital Wallet Sale (International tourist / USD corporate invoice)
  const s3Res = insertSale.run(
    tenant1Id,
    store1Id,
    terminal1Id,
    session1Id,
    cashierId,
    cust1Id,
    'OR-2026-10003',
    crypto.randomUUID(),
    'USD',
    '39.48',
    '0.00',
    '4.74',
    '0.00',
    '44.22',
    '21.89',
    '17.59',
    'WALLET',
    '44.22',
    '0.00',
    JSON.stringify([{ method: 'WALLET', amount: '44.22', reference: 'PAYPAL-TX-88410' }]),
    'OFFLINE_SYNCED',
    now
  );
  const sale3Id = Number(s3Res.lastInsertRowid);
  insertSaleItem.run(tenant1Id, sale3Id, productIds[0], 'AUR-ESP-340', 'Dark Matter Espresso Whole Bean (340g)', 'Whole Bean', 2, '6.50', '11.62', '0.00', '2.79', '23.24');
  insertSaleItem.run(tenant1Id, sale3Id, productIds[1], 'NSH-MTC-040', 'Nishi Uji Ceremonial Matcha Tin (40g)', '40g Standard Tin', 1, '8.89', '16.24', '0.00', '1.95', '16.24');

  // Subscription Invoices
  const insertInvoice = db.prepare(`
    INSERT INTO subscription_invoices (tenant_id, invoice_number, plan_code, billing_cycle, currency_code, amount, status, provider_ref, paid_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PAID', ?, ?, ?)
  `);
  insertInvoice.run(tenant1Id, 'INV-SAAS-2026-001', 'PREMIUM', 'MONTHLY', 'USD', '39.00', 'STRIPE-SUB-882190', now, now);
  insertInvoice.run(tenant2Id, 'INV-SAAS-2026-002', 'BUSINESS', 'MONTHLY', 'USD', '19.00', 'STRIPE-SUB-882195', now, now);

  // Offline Sync Log sample
  db.prepare(`
    INSERT INTO offline_sync_logs (tenant_id, store_id, client_uuid, transaction_number, sync_status, conflict_detected, conflict_resolution, payload_summary, synced_at)
    VALUES (?, ?, ?, 'OR-2026-10003', 'SYNCHRONIZED', 0, 'CLEAN_COMMIT', 'USD $44.22 · 3 items · Idempotency verified', ?)
  `).run(tenant1Id, store1Id, crypto.randomUUID(), now);

  // Audit Log entries
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (tenant_id, user_id, actor_name, actor_role, action, entity_type, entity_id, ip_address, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAudit.run(tenant1Id, ownerId, 'Marco Santos', 'BUSINESS_OWNER', 'TENANT_INITIALIZED', 'Tenant', String(tenant1Id), '10.24.0.12', 'Configured PHP primary currency, 12% VAT, and negative stock prevention policy.', now);
  insertAudit.run(tenant1Id, cashierId, 'Liam Cruz', 'CASHIER', 'REGISTER_OPENED', 'CashRegisterSession', String(session1Id), '10.24.0.45', 'Opened POS-MKT-01 register drawer with ₱5,000.00 opening float.', now);
  insertAudit.run(null, 1, 'Elena Vance', 'SUPERADMIN', 'PLATFORM_BACKUP_VERIFIED', 'SystemBackup', '1', '10.0.0.1', 'Executed automated daily snapshot and SHA-256 integrity verification.', now);

  // Initial verified backup record
  db.prepare(`
    INSERT INTO system_backups (filename, size_bytes, checksum_sha256, tables_count, records_count, is_verified, storage_driver, created_by, created_at)
    VALUES ('smartpos-prod-snapshot-20261110.sql.gz', 492840, ?, 24, 68, 1, 'local-encrypted + s3-compatible', 'Elena Vance (Superadmin)', ?)
  `).run(crypto.createHash('sha256').update('smartpos_backup_seed_1').digest('hex'), now);
}

export function logAudit(params: {
  tenantId: number | null;
  userId: number | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}) {
  db.prepare(`
    INSERT INTO audit_logs (tenant_id, user_id, actor_name, actor_role, action, entity_type, entity_id, ip_address, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '127.0.0.1', ?, ?)
  `).run(
    params.tenantId,
    params.userId,
    params.actorName,
    params.actorRole,
    params.action,
    params.entityType,
    params.entityId,
    params.details,
    new Date().toISOString()
  );
}
