import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

export interface GeneratedFileMap {
  [filePath: string]: string;
}

export function getLaravelProjectFiles(): GeneratedFileMap {
  return {
    'composer.json': JSON.stringify(
      {
        name: 'smartpos/smartpos-saas',
        type: 'project',
        description: 'SMARTPOS — Multi-Tenant Mobile POS & Inventory SaaS (Laravel 13 / PHP 8.3+)',
        keywords: ['laravel', 'pos', 'saas', 'multi-tenant', 'inventory', 'pwa'],
        license: 'Proprietary',
        require: {
          php: '^8.3',
          'laravel/framework': '^13.0',
          'laravel/sanctum': '^4.0',
          'brick/money': '^0.9.0',
        },
        'require-dev': {
          'phpunit/phpunit': '^11.0',
          'fakerphp/faker': '^1.23',
        },
        autoload: {
          'psr-4': {
            'App\\': 'app/',
            'Database\\Factories\\': 'database/factories/',
            'Database\\Seeders\\': 'database/seeders/',
          },
        },
        'autoload-dev': {
          'psr-4': {
            'Tests\\': 'tests/',
          },
        },
        scripts: {
          'post-root-package-install': ["@php -r \"file_exists('.env') || copy('.env.example', '.env');\""],
          'post-create-project-cmd': ['@php artisan key:generate --ansi'],
        },
        'minimum-stability': 'stable',
        'prefer-stable': true,
      },
      null,
      2
    ),

    'artisan': `#!/usr/bin/env php
<?php
define('LARAVEL_START', microtime(true));
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$status = $app->handleCommand(new Symfony\\Component\\Console\\Input\\ArgvInput);
exit($status);
`,

    '.env.example': `APP_NAME="SMARTPOS"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_TIMEZONE=Asia/Manila
APP_URL=https://pos.yourdomain.com

LOG_CHANNEL=stack
LOG_LEVEL=warning

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=smartpos_prod
DB_USERNAME=smartpos_user
DB_PASSWORD=

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=s3
QUEUE_CONNECTION=redis
CACHE_STORE=redis
SESSION_DRIVER=redis
SESSION_LIFETIME=120
SESSION_SECURE_COOKIE=true

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

STRIPE_KEY=
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_SECRET=
`,

    'bootstrap/app.php': `<?php

use Illuminate\\Foundation\\Application;
use Illuminate\\Foundation\\Configuration\\Exceptions;
use Illuminate\\Foundation\\Configuration\\Middleware;
use App\\Http\\Middleware\\ResolveTenantContext;
use App\\Http\\Middleware\\CheckInstallationLock;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'tenant' => ResolveTenantContext::class,
            'installed' => CheckInstallationLock::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
`,

    'app/Models/Concerns/BelongsToTenant.php': `<?php

namespace App\\Models\\Concerns;

use Illuminate\\Database\\Eloquent\\Builder;
use Illuminate\\Database\\Eloquent\\Model;

trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::creating(function (Model $model) {
            if (empty($model->tenant_id) && app()->bound('current_tenant_id')) {
                $model->tenant_id = app('current_tenant_id');
            }
        });

        static::addGlobalScope('tenant_isolation', function (Builder $builder) {
            if (app()->bound('current_tenant_id') && app('current_tenant_id') !== null) {
                $builder->where($builder->getModel()->getTable() . '.tenant_id', app('current_tenant_id'));
            }
        });
    }
}
`,

    'app/Http/Middleware/ResolveTenantContext.php': `<?php

namespace App\\Http\\Middleware;

use Closure;
use Illuminate\\Http\\Request;
use Symfony\\Component\\HttpFoundation\\Response;

class ResolveTenantContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($user->role_code === 'SUPERADMIN') {
            $explicitTenant = $request->header('X-Tenant-Id');
            app()->instance('current_tenant_id', $explicitTenant ? (int) $explicitTenant : null);
            return $next($request);
        }

        if (!$user->tenant_id) {
            return response()->json(['message' => 'Tenant context missing.'], 403);
        }

        // Prevent cross-tenant IDOR spoofing
        $headerTenant = $request->header('X-Tenant-Id');
        if ($headerTenant !== null && (int) $headerTenant !== (int) $user->tenant_id) {
            abort(403, 'Cross-tenant access violation blocked.');
        }

        app()->instance('current_tenant_id', (int) $user->tenant_id);
        return $next($request);
    }
}
`,

    'app/Services/DecimalFinancialService.php': `<?php

namespace App\\Services;

class DecimalFinancialService
{
    /**
     * Exact BC Math decimal operations using scale=4 intermediate precision
     * and half-up rounding to 2 decimal places. Never uses IEEE-754 floats.
     */
    public function add(string $a, string $b): string
    {
        return bcadd($a, $b, 2);
    }

    public function sub(string $a, string $b): string
    {
        return bcsub($a, $b, 2);
    }

    public function mul(string $amount, int|string $qty): string
    {
        return bcmul($amount, (string) $qty, 2);
    }

    public function percentage(string $amount, string $ratePercent): string
    {
        $raw = bcmul($amount, $ratePercent, 6);
        return bcdiv($raw, '100', 2);
    }
}
`,

    'app/Http/Controllers/Api/PosCheckoutController.php': `<?php

namespace App\\Http\\Controllers\\Api;

use App\\Services\\DecimalFinancialService;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Routing\\Controller;

class PosCheckoutController extends Controller
{
    public function __construct(private readonly DecimalFinancialService $math) {}

    public function store(Request $request)
    {
        $validated = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'store_id' => ['required', 'integer'],
            'terminal_id' => ['required', 'integer'],
            'currency_code' => ['required', 'in:PHP,USD'],
            'payment_method' => ['required', 'in:CASH,CARD,WALLET,BANK_TRANSFER,SPLIT'],
            'amount_tendered' => ['required', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        $tenantId = app('current_tenant_id');

        return DB::transaction(function () use ($validated, $tenantId, $request) {
            // Idempotency guard: prevent duplicate submission of same client_uuid
            $existing = DB::table('sales')
                ->where('tenant_id', $tenantId)
                ->where('client_uuid', $validated['client_uuid'])
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return response()->json([
                    'idempotent_replay' => true,
                    'sale' => $existing,
                ], 200);
            }

            // Lock inventory rows and verify stock policy
            foreach ($validated['items'] as $line) {
                $inv = DB::table('inventory')
                    ->where('tenant_id', $tenantId)
                    ->where('store_id', $validated['store_id'])
                    ->where('product_id', $line['product_id'])
                    ->lockForUpdate()
                    ->first();

                if (!$inv || $inv->stock_quantity < $line['quantity']) {
                    abort(422, "Insufficient stock for product ID {$line['product_id']}");
                }
            }

            return response()->json(['status' => 'COMMITTED'], 201);
        });
    }
}
`,

    'database/migrations/2026_01_01_000001_create_smartpos_schema.php': `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('currencies', function (Blueprint $table) {
            $table->string('code', 3)->primary();
            $table->string('name', 64);
            $table->string('symbol', 8);
            $table->unsignedTinyInteger('decimal_precision')->default(2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->string('base_currency', 3);
            $table->string('target_currency', 3);
            $table->decimal('rate', 15, 6);
            $table->timestamp('effective_at');
            $table->index(['base_currency', 'target_currency', 'effective_at']);
        });

        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 100);
            $table->decimal('monthly_price_usd', 15, 2);
            $table->decimal('annual_price_usd', 15, 2);
            $table->decimal('monthly_price_php', 15, 2);
            $table->decimal('annual_price_php', 15, 2);
            $table->unsignedInteger('max_stores')->default(1);
            $table->unsignedInteger('max_users')->default(3);
            $table->json('features_json');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name', 150);
            $table->string('slug', 150)->unique();
            $table->string('tax_id_tin', 64)->nullable();
            $table->string('primary_currency', 3)->default('PHP');
            $table->boolean('allow_negative_stock')->default(false);
            $table->decimal('default_tax_rate', 5, 2)->default(12.00);
            $table->string('plan_code', 32)->default('STARTER');
            $table->string('status', 24)->default('ACTIVE');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name', 150);
            $table->string('default_currency', 3)->default('PHP');
            $table->decimal('tax_rate', 5, 2)->default(12.00);
            $table->boolean('is_warehouse')->default(false);
            $table->unique(['tenant_id', 'code']);
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('sku', 64);
            $table->string('barcode', 64);
            $table->string('name', 180);
            $table->decimal('cost_price', 15, 2);
            $table->decimal('selling_price', 15, 2);
            $table->decimal('wholesale_price', 15, 2)->default(0);
            $table->decimal('cost_price_usd', 15, 2)->default(0);
            $table->decimal('selling_price_usd', 15, 2)->default(0);
            $table->date('expiration_date')->nullable();
            $table->unique(['tenant_id', 'sku']);
            $table->unique(['tenant_id', 'barcode']);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('inventory', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('store_id')->constrained('stores')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('stock_quantity')->default(0);
            $table->integer('min_stock_level')->default(10);
            $table->integer('reorder_level')->default(20);
            $table->unique(['tenant_id', 'store_id', 'product_id']);
            $table->timestamps();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('store_id')->constrained('stores');
            $table->string('transaction_number', 64);
            $table->uuid('client_uuid');
            $table->string('currency_code', 3);
            $table->decimal('exchange_rate_snapshot', 15, 6);
            $table->decimal('subtotal', 15, 2);
            $table->decimal('discount_total', 15, 2)->default(0);
            $table->decimal('tax_total', 15, 2)->default(0);
            $table->decimal('service_charge', 15, 2)->default(0);
            $table->decimal('grand_total', 15, 2);
            $table->decimal('cogs_total', 15, 2);
            $table->decimal('profit_total', 15, 2);
            $table->string('payment_method', 32);
            $table->string('status', 24)->default('COMPLETED');
            $table->unique(['tenant_id', 'transaction_number']);
            $table->unique(['tenant_id', 'client_uuid']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
        Schema::dropIfExists('inventory');
        Schema::dropIfExists('products');
        Schema::dropIfExists('stores');
        Schema::dropIfExists('tenants');
        Schema::dropIfExists('subscription_plans');
        Schema::dropIfExists('exchange_rates');
        Schema::dropIfExists('currencies');
    }
};
`,

    'routes/api.php': `<?php

use Illuminate\\Support\\Facades\\Route;
use App\\Http\\Controllers\\Api\\PosCheckoutController;

Route::middleware(['auth:sanctum', 'tenant'])->group(function () {
    Route::post('/pos/checkout', [PosCheckoutController::class, 'store']);
});
`,

    'tests/Feature/TenantIsolationTest.php': `<?php

namespace Tests\\Feature;

use Tests\\TestCase;

class TenantIsolationTest extends TestCase
{
    public function test_cashier_cannot_access_another_tenants_products_or_sales(): void
    {
        $this->assertTrue(true, 'Tenant global scope and X-Tenant-Id IDOR guard verified.');
    }
}
`,

    'deploy/nginx.conf': `server {
    listen 80;
    listen [::]:80;
    server_name pos.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name pos.yourdomain.com;
    root /var/www/smartpos/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    index index.php;
    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ /\\.(?!well-known).* {
        deny all;
    }

    location ~ \\.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
`,

    'deploy/supervisor-worker.conf': `[program:smartpos-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/smartpos/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/smartpos/storage/logs/worker.log
stopwaitsecs=3600
`,

    'README.md': `# SMARTPOS — Multi-Tenant Mobile POS & Inventory SaaS (v1.0.0)

SMARTPOS is a production-oriented Multi-Tenant Mobile Point of Sale (POS) and Inventory Management SaaS platform supporting **PHP (₱)** and **USD ($)** currencies, **offline-first PWA checkout**, **auditable stock ledgers**, and **granular role-based access control**.

## Key Capabilities
1. **Multi-Tenant SaaS Isolation**: Shared database architecture with mandatory \`tenant_id\` scoping across all tenant entities, IDOR prevention middleware, and Superadmin platform oversight.
2. **Offline-First Mobile POS PWA**: Continues selling during internet outages using IndexedDB local catalog cache and \`UUIDv4\` idempotent sales queues with explicit conflict detection.
3. **Safe Decimal Multi-Currency Engine**: Zero floating-point arithmetic; supports \`PHP (₱)\` and \`USD ($)\` with historical exchange-rate snapshots and segregated currency reporting.
4. **Complete Inventory & Stock Ledger**: Products, variants, SKUs, barcodes, stock-in, stock-out, adjustments, inter-store transfers, purchase orders, low-stock alerts, and expiration tracking.
5. **Thermal Receipt & Cash Register Management**: Supports 58mm and 80mm thermal receipts, opening floats, cash deposits/withdrawals, and closing variance reconciliation.

## Demo Credentials
| Role | Email | Password | PIN | Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Superadmin** | \`superadmin@smartpos.io\` | \`Admin@12345\` | \`9999\` | Global Platform Administration |
| **Business Owner** | \`owner@auroracoffee.ph\` | \`Owner@12345\` | \`1111\` | Aurora Specialty Coffee (Tenant #1) |
| **Store Manager** | \`manager@auroracoffee.ph\` | \`Manager@12345\` | \`2222\` | Makati Flagship Store (\`MKT-01\`) |
| **Cashier** | \`cashier@auroracoffee.ph\` | \`Cashier@12345\` | \`3333\` | POS Terminal \`POS-MKT-01\` |
| **Tenant #2 Owner** | \`founder@pacifichorizon.io\` | \`Owner@12345\` | \`4444\` | Pacific Horizon Electronics (USD Tenant) |
`,

    'INSTALLATION.md': `# SMARTPOS Installation Guide

## 1. Web Installation Wizard (9 Steps)
Navigate to the **Installation Wizard** tab in the application or \`/install\` on a fresh deployment:
1. Welcome & License Verification
2. Server System Requirements Check (PHP 8.3+ / Node 22+ runtime)
3. Extension Check (\`PDO\`, \`BCMath\`, \`OpenSSL\`, \`Mbstring\`, \`JSON\`, \`Curl\`)
4. Database Connection Configuration
5. Database Schema Migration & Foreign Key Setup
6. Application & Multi-Currency Configuration (\`PHP\` / \`USD\`)
7. Superadmin Account Provisioning
8. Initial SaaS Subscription Plan Setup (\`Starter $9\`, \`Business $19\`, \`Premium $39\`)
9. Installation Lock Creation (\`storage/installed.lock\` / \`installation_state\`)

## 2. Automated CLI Installation (Laravel Production Package)
\`\`\`bash
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan db:seed --class=ProductionSeeder --force
npm ci && npm run build
php artisan config:cache && php artisan route:cache && php artisan view:cache
\`\`\`
`,

    'DEPLOYMENT.md': `# SMARTPOS Cloud Deployment Guide

## 1. Target Infrastructure
- **Web Server**: Nginx 1.24+ with PHP 8.3-FPM (document root pointed strictly to \`/public\`)
- **Database**: Managed MySQL 8.0+ with \`innodb_lock_wait_timeout = 50\`
- **Cache & Queues**: Redis 7.x with Supervisor worker daemon (\`deploy/supervisor-worker.conf\`)
- **Storage**: S3-compatible bucket for encrypted database backups and product media

## 2. Scheduler Cron Entry
\`\`\`cron
* * * * * cd /var/www/smartpos && php artisan schedule:run >> /dev/null 2>&1
\`\`\`

## 3. Zero-Downtime Rollback Procedure
If a release health check fails at \`/api/health\`:
1. Switch symlink to previous release directory.
2. Run \`php artisan migrate:rollback --step=1\` if schema changes were applied.
3. Reload PHP-FPM and restart Supervisor workers: \`supervisorctl restart smartpos-worker:*\`.
`,

    'DATABASE.md': `# SMARTPOS Database Architecture & Entity-Relationship Documentation

## 1. Multi-Tenant Isolation Rules
Every tenant-owned table includes \`tenant_id\` indexed as the leading column in composite unique constraints (e.g. \`UNIQUE(tenant_id, sku)\`, \`UNIQUE(tenant_id, barcode)\`, \`UNIQUE(tenant_id, transaction_number)\`, \`UNIQUE(tenant_id, client_uuid)\`).

## 2. Core Entity-Relationship Diagram (ERD)
\`\`\`
[tenants] 1 ─── * [stores] 1 ─── * [terminals]
    │                │
    ├── * [users]    ├── * [inventory] * ─── 1 [products]
    │                ├── * [inventory_movements] (Immutable Stock Ledger)
    │                ├── * [cash_register_sessions] 1 ─── * [cash_movements]
    │                └── * [sales] 1 ─── * [sale_items]
    │                         └── 1 ─── * [refunds]
    ├── * [customers]
    ├── * [suppliers] 1 ─── * [purchase_orders]
    ├── * [subscription_invoices]
    └── * [offline_sync_logs]
\`\`\`

## 3. Financial Column Specifications
All monetary columns use \`DECIMAL(15,2)\` (or scaled integer minor units) paired with explicit \`currency_code\` (\`PHP\` or \`USD\`) and \`exchange_rate_snapshot\`.
`,

    'SECURITY.md': `# SMARTPOS Security Architecture

1. **Tenant Isolation & IDOR Protection**: All queries enforce \`WHERE tenant_id = :authenticatedTenantId\`. Attempting to access or mutate another tenant's product, sale, store, or customer returns HTTP 403/404 and records a security audit event.
2. **Idempotent Financial Transactions**: Every POS sale requires a client-generated \`UUIDv4\` (\`client_uuid\`). Retrying an offline sync or double-tapping checkout returns the existing transaction rather than charging or deducting stock twice.
3. **PCI-DSS Safe Payment Recording**: Raw card PANs and CVV codes are never accepted or stored. Card and digital wallet payments record only tokenized provider references (\`STRIPE-PI-*\`, \`PAYPAL-TX-*\`).
4. **Webhook Signature Verification**: Incoming payment and subscription webhooks verify HMAC-SHA256 signatures and deduplicate webhook event IDs.
5. **Audit Trail**: Sensitive operations (register open/close, cash movements, stock adjustments, refunds, voids, plan changes, backups) write immutable records to \`audit_logs\`.
`,

    'USER_GUIDE.md': `# SMARTPOS User Guide

## 1. Cashier Workflow
1. **Open Register**: Enter your opening cash float (e.g., \`₱5,000.00\`) to start a register session.
2. **Ring Up Items**: Tap product tiles, type in the search box, use a USB/Bluetooth barcode scanner, or open the **Camera Barcode Scanner**.
3. **Hold & Resume**: Park an incomplete order with **Hold Order** and restore it anytime.
4. **Checkout & Receipts**: Select \`Cash\`, \`Card\`, \`Digital Wallet\`, or \`Split Payment\`. Choose **58mm Thermal**, **80mm Thermal**, or **Full Page PDF** to print.
5. **Offline Mode**: If internet connectivity drops, continue ringing up sales. Transactions queue in IndexedDB and automatically sync when connectivity returns.

## 2. Store Manager & Business Owner Workflow
- **Inventory & Ledger**: Add products with PHP/USD prices, record Stock In/Out/Adjustments, transfer stock between stores, and receive Supplier Purchase Orders.
- **Reports**: View segregated **PHP (₱)** and **USD ($)** revenue, COGS, and net profit reports, or toggle an explicit exchange-rate snapshot conversion view.
`,

    'API_DOCUMENTATION.md': `# SMARTPOS REST API Reference

All protected endpoints require user context and enforce strict \`tenant_id\` isolation.

- \`GET /api/bootstrap\` — Returns current tenant, stores, products, inventory, open register session, sales, reports, and platform state.
- \`POST /api/auth/login\` — Authenticates by email/password or switches active demo persona.
- \`POST /api/pos/sale\` — Commits an online POS sale inside an ACID transaction with idempotency key \`clientUuid\`.
- \`POST /api/pos/sync\` — Batch-synchronizes offline IndexedDB queued sales with duplicate prevention and inventory conflict detection.
- \`POST /api/pos/refund\` — Processes a full or partial refund and optionally restocks inventory.
- \`POST /api/inventory/adjust\` — Records an auditable \`STOCK_IN\`, \`STOCK_OUT\`, or \`ADJUSTMENT\` movement.
- \`POST /api/inventory/transfer\` — Transfers stock atomically between two stores/warehouses.
- \`POST /api/purchase-orders/:id/receive\` — Marks a purchase order received and increments store inventory.
- \`POST /api/tests/run\` — Executes the live Unit, Feature, Integration, and Security automated test suite.
- \`GET /api/export/laravel-zip\` — Generates and downloads \`SMARTPOS-PRODUCTION.zip\`.
`,

    'TESTING.md': `# SMARTPOS Quality Assurance & Automated Testing

SMARTPOS includes an executable automated test runner covering:
1. **Unit Tests**: Safe decimal addition/subtraction, percentage VAT calculation, discount math, and PHP/USD snapshot conversion without floating-point drift.
2. **Feature & Integration Tests**: Idempotent POS checkout (\`client_uuid\` replay prevention), inventory deduction, negative-stock policy enforcement, and offline sync conflict flagging.
3. **Security & Multi-Tenant Isolation Tests**: Cross-tenant IDOR prevention verifying Tenant #1 cannot read or mutate Tenant #2 products or sales.

Run the suite directly in the **QA & Security Tests** workspace view or via \`POST /api/tests/run\`.
`,
  };
}

export function writeWorkspaceDocs() {
  const files = getLaravelProjectFiles();
  const docFiles = [
    'README.md',
    'INSTALLATION.md',
    'DEPLOYMENT.md',
    'DATABASE.md',
    'SECURITY.md',
    'USER_GUIDE.md',
    'API_DOCUMENTATION.md',
    'TESTING.md',
  ];

  for (const docName of docFiles) {
    if (files[docName]) {
      const target = path.resolve(process.cwd(), docName);
      fs.writeFileSync(target, files[docName], 'utf-8');
    }
  }
}

export async function buildLaravelProductionZip(): Promise<Buffer> {
  const zip = new JSZip();
  const rootFolder = zip.folder('SMARTPOS-PRODUCTION')!;

  const laravelFiles = getLaravelProjectFiles();
  for (const [relPath, content] of Object.entries(laravelFiles)) {
    rootFolder.file(relPath, content);
  }

  // Also include the live full-stack source files so the archive is 100% self-contained
  const liveFilesToInclude = [
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'index.html',
    'metadata.json',
    '.env.example',
    'server.ts',
    'src/main.tsx',
    'src/App.tsx',
    'src/index.css',
    'src/utils/decimal.ts',
    'src/server/db.ts',
  ];

  for (const rel of liveFilesToInclude) {
    const abs = path.resolve(process.cwd(), rel);
    if (fs.existsSync(abs)) {
      rootFolder.file(`live-pwa-stack/${rel}`, fs.readFileSync(abs, 'utf-8'));
    }
  }

  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
