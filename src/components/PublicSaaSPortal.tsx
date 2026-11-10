import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ShieldCheck,
  WifiOff,
  Store,
  Lock,
  Download,
  Sun,
  Moon,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { formatMoney } from '../utils/decimal.ts';

interface PublicSaaSPortalProps {
  subscriptionPlans: any[];
  demoUsers: any[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectDemoUser: (userId: number, targetTab?: string) => void;
  onLoginSuccess: (userId: number) => void;
  onEnterWorkspace: () => void;
}

export const PublicSaaSPortal: React.FC<PublicSaaSPortalProps> = ({
  subscriptionPlans,
  demoUsers,
  darkMode,
  onToggleDarkMode,
  onSelectDemoUser,
  onLoginSuccess,
  onEnterWorkspace,
}) => {
  const [subView, setSubView] = useState<'LANDING' | 'PRICING' | 'LOGIN' | 'REGISTER'>('LANDING');
  const [billingCadence, setBillingCadence] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [pricingCurrency, setPricingCurrency] = useState<'USD' | 'PHP'>('USD');

  // Login State
  const [loginEmail, setLoginEmail] = useState('owner@auroracoffee.ph');
  const [loginPassword, setLoginPassword] = useState('Owner@12345');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Registration State
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regCurrency, setRegCurrency] = useState<'PHP' | 'USD'>('PHP');
  const [regPlan, setRegPlan] = useState<'STARTER' | 'BUSINESS' | 'PREMIUM'>('BUSINESS');

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
      } else {
        onLoginSuccess(data.user.id);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Network error');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: regBusinessName,
          ownerName: regOwnerName,
          email: regEmail,
          password: regPassword,
          phone: regPhone,
          address: regAddress,
          primaryCurrency: regCurrency,
          planCode: regPlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Registration failed');
      } else {
        onLoginSuccess(data.userId);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Network error');
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Mandatory 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => setSubView('LANDING')}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 font-display"
        >
          SMARTPOS
        </button>

        {/* Zone 2: 4–5 single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => setSubView('LANDING')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Platform
          </button>
          <button
            type="button"
            onClick={() => setSubView('PRICING')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Pricing
          </button>
          <button
            type="button"
            onClick={() => setSubView('LOGIN')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setSubView('REGISTER')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Register Business
          </button>
          <a
            href="/api/export/laravel-zip"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0"
          >
            Download ZIP
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onEnterWorkspace}
            className="min-h-[44px] px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <span>Open Live POS</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Secondary Utility Strip Below Header for Theme, PWA Install & Instant Demo Role Access */}
      <div className="bg-slate-100/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-600 dark:text-slate-400">Instant Demo Launch:</span>
            {demoUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() =>
                  onSelectDemoUser(
                    u.id,
                    u.role_code === 'SUPERADMIN'
                      ? 'SUPERADMIN'
                      : u.role_code === 'CASHIER'
                      ? 'POS'
                      : 'DASHBOARD'
                  )
                }
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-200 font-medium transition-colors whitespace-nowrap shrink-0"
              >
                {u.role_code}: {u.name.split(' (')[0]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Light Theme' : 'Dark Theme'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12">
        {subView === 'LANDING' && (
          <div className="space-y-16">
            {/* Hero 2-Column Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Multi-Tenant Cloud Retail Architecture · Offline-First PWA · PHP (₱) & USD ($)
                </div>

                <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
                  Commercial Mobile POS and Auditable Inventory for Multi-Store Retail.
                </h1>

                <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                  Keep ringing up customers even when store internet drops. SMARTPOS combines an IndexedDB offline checkout queue, exact integer-scaled decimal accounting across Philippine Peso (₱) and US Dollar ($), and strict tenant-isolated stock ledgers.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onEnterWorkspace}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Launch Touch POS Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubView('REGISTER')}
                    className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                  >
                    Register New Business Tenant
                  </button>
                  <a
                    href="/api/export/laravel-zip"
                    className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>SMARTPOS-PRODUCTION.zip</span>
                  </a>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="relative h-full min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
                  <img
                    src="/src/assets/images/pos_hero_terminal_1794314139858.jpg"
                    alt="SMARTPOS touchscreen terminal and thermal receipt printer on a retail counter"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-6 text-white">
                    <p className="text-xs font-mono text-blue-300">
                      58mm & 80mm Thermal Bridge · Camera & USB Barcode Wedge
                    </p>
                    <p className="text-lg font-semibold mt-1">
                      Designed for smartphones, tablets, and countertop touch terminals.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Full-Width 4-Column Quantitative Proof Row Below Hero */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  100% UUID
                </p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                  Idempotent Offline Sync
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Client-generated UUIDv4 tokens prevent duplicate sales and flag negative stock conflicts.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  DECIMAL(15,2)
                </p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                  Zero Floating-Point Drift
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Segregated PHP (₱) and USD ($) ledgers with historical exchange-rate snapshots at time of sale.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  4 RBAC Tiers
                </p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                  Strict Tenant Isolation
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Superadmin, Business Owner, Store Manager, and Cashier roles with IDOR protection.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  Laravel 13 + PWA
                </p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                  Verified Production Package
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Includes downloadable SMARTPOS-PRODUCTION.zip with MySQL 8+ migrations, seeders & cloud configs.
                </p>
              </div>
            </div>

            {/* Core Architecture Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <WifiOff className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  01. Offline-First POS & Conflict Guard
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Cashiers continue scanning barcodes, holding carts, and printing thermal receipts offline. When internet returns, pending transactions sync automatically without silently overwriting server stock.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <Store className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  02. Multi-Store & Warehouse Stock Ledger
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Every Stock In, Stock Out, Adjustment, Inter-Store Transfer, Sale, and Refund writes an immutable movement entry with before/after quantities and COGS valuation.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  03. Cash Register Accountability
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Track opening floats, cash deposits, withdrawals, cash sales, and refunds per shift, automatically computing expected vs. actual drawer closing variance.
                </p>
              </div>
            </div>
          </div>
        )}

        {(subView === 'PRICING' || subView === 'LANDING') && (
          <div className={subView === 'LANDING' ? 'mt-20 pt-12 border-t border-slate-200 dark:border-slate-800' : ''}>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  Transparent Multi-Tenant Subscription Plans
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Choose monthly or annual billing in USD ($) or Philippine Peso (₱). Superadmins can customize all plan prices live.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setBillingCadence('MONTHLY')}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      billingCadence === 'MONTHLY'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Monthly Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCadence('ANNUAL')}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      billingCadence === 'ANNUAL'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Annual (2 Months Free)
                  </button>
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setPricingCurrency('USD')}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
                      pricingCurrency === 'USD'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingCurrency('PHP')}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
                      pricingCurrency === 'PHP'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    PHP (₱)
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subscriptionPlans.map((plan) => {
                const amount =
                  pricingCurrency === 'USD'
                    ? billingCadence === 'ANNUAL'
                      ? plan.annual_price_usd
                      : plan.monthly_price_usd
                    : billingCadence === 'ANNUAL'
                    ? plan.annual_price_php
                    : plan.monthly_price_php;

                const isHighlighted = plan.code === 'BUSINESS';
                return (
                  <div
                    key={plan.code}
                    className={`p-6 rounded-2xl border flex flex-col justify-between ${
                      isHighlighted
                        ? 'bg-white dark:bg-slate-900 border-blue-600 dark:border-blue-500 ring-1 ring-blue-600/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {plan.tagline}
                        </p>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                          {plan.name}
                        </h3>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                          {formatMoney(amount, pricingCurrency)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                          / {billingCadence === 'ANNUAL' ? 'year' : 'month'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        Limits: {plan.max_stores} Store(s) · {plan.max_users} Staff Accounts · {plan.max_products.toLocaleString()} SKUs
                      </div>

                      <ul className="space-y-2.5 pt-2">
                        {(plan.features || []).map((feat: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setRegPlan(plan.code);
                        setSubView('REGISTER');
                      }}
                      className={`mt-6 w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors ${
                        isHighlighted
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white'
                      }`}
                    >
                      Start 14-Day Free Trial on {plan.name}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {subView === 'LOGIN' && (
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-7 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Sign In to SMARTPOS
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Authenticate with your tenant credentials or select a pre-seeded demo account below.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {authError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                {authLoading ? 'Signing in...' : 'Sign In to Workspace'}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Documented Demo Credentials (Click to auto-fill):
              </p>
              <div className="space-y-1.5 text-xs font-mono">
                {[
                  { label: 'Superadmin', email: 'superadmin@smartpos.io', pass: 'Admin@12345' },
                  { label: 'Business Owner (Tenant #1 PHP)', email: 'owner@auroracoffee.ph', pass: 'Owner@12345' },
                  { label: 'Store Manager (Makati)', email: 'manager@auroracoffee.ph', pass: 'Manager@12345' },
                  { label: 'Cashier (POS Terminal)', email: 'cashier@auroracoffee.ph', pass: 'Cashier@12345' },
                  { label: 'Tenant #2 Owner (USD Isolation)', email: 'founder@pacifichorizon.io', pass: 'Owner@12345' },
                ].map((cred) => (
                  <button
                    key={cred.email}
                    type="button"
                    onClick={() => {
                      setLoginEmail(cred.email);
                      setLoginPassword(cred.pass);
                    }}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-left flex items-center justify-between"
                  >
                    <span className="font-sans font-medium text-slate-700 dark:text-slate-200">{cred.label}</span>
                    <span className="text-slate-500">{cred.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {subView === 'REGISTER' && (
          <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-7 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Register New Multi-Tenant Business Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Provisions an isolated tenant workspace, default store, POS terminal, and opening cash register drawer.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {authError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Business / Retail Brand Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Manila Artisan Roasters Inc."
                  value={regBusinessName}
                  onChange={(e) => setRegBusinessName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Owner Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Juan Dela Cruz"
                  value={regOwnerName}
                  onChange={(e) => setRegOwnerName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Work Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="owner@business.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  placeholder="+63 917 000 0000"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Primary Accounting Currency
                </label>
                <select
                  value={regCurrency}
                  onChange={(e) => setRegCurrency(e.target.value as 'PHP' | 'USD')}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                >
                  <option value="PHP">PHP — Philippine Peso (₱)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subscription Tier
                </label>
                <select
                  value={regPlan}
                  onChange={(e) => setRegPlan(e.target.value as any)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                >
                  <option value="STARTER">Starter ($9/mo)</option>
                  <option value="BUSINESS">Business ($19/mo)</option>
                  <option value="PREMIUM">Premium ($39/mo)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Store Physical Address
                </label>
                <input
                  type="text"
                  placeholder="Street, City, Province / State"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                >
                  {authLoading ? 'Provisioning Tenant Workspace...' : 'Create Tenant & Launch POS'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            <span>SMARTPOS v1.0.0 · Multi-Tenant POS & Inventory SaaS · PHP (₱) & USD ($) Decimal Ledger</span>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setSubView('PRICING')} className="hover:underline">
              Plans
            </button>
            <button type="button" onClick={() => setSubView('LOGIN')} className="hover:underline">
              Sign In
            </button>
            <a href="/api/export/laravel-zip" className="hover:underline font-medium text-blue-600 dark:text-blue-400">
              Download SMARTPOS-PRODUCTION.zip
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
