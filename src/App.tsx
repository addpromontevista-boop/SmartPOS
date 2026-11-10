/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ShoppingCart,
  Package,
  BarChart3,
  Wifi,
  WifiOff,
  RefreshCw,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  PlayCircle,
  Printer,
  RotateCcw,
  ArrowLeftRight,
  Vault,
  Users,
  Settings,
  ShieldCheck,
  Sun,
  Moon,
  Download,
  Search,
  AlertTriangle,
  CheckCircle2,
  Building2,
  CreditCard,
  Banknote,
  Wallet,
  Split,
  FileSpreadsheet,
  Globe,
} from 'lucide-react';
import {
  CurrencyCode,
  toCents,
  fromCents,
  addDecimal,
  subDecimal,
  mulDecimal,
  calcPercentage,
  compareDecimal,
  formatMoney,
  convertWithRateSnapshot,
} from './utils/decimal.ts';
import {
  OfflineQueuedSale,
  HeldOrderRecord,
  saveOfflineCatalogCache,
  getOfflineCatalogCache,
  enqueueOfflineSale,
  getOfflineSalesQueue,
  updateOfflineSaleStatus,
  saveHeldOrder,
  getHeldOrders,
  deleteHeldOrder,
} from './utils/offlineDb.ts';
import { PWAInstallButton, registerSmartPosServiceWorker } from './components/PWAInstallButton.tsx';
import { ReceiptModal } from './components/ReceiptModal.tsx';
import { BarcodeScannerModal } from './components/BarcodeScannerModal.tsx';
import { PublicSaaSPortal } from './components/PublicSaaSPortal.tsx';
import { PlatformOpsCenter } from './components/PlatformOpsCenter.tsx';

registerSmartPosServiceWorker();

type WorkspaceTab =
  | 'POS'
  | 'OFFLINE_SYNC'
  | 'INVENTORY'
  | 'REGISTER'
  | 'DASHBOARD'
  | 'CUSTOMERS'
  | 'SUBSCRIPTION'
  | 'SETTINGS'
  | 'SUPERADMIN'
  | 'INSTALLER'
  | 'BACKUPS'
  | 'TESTS';

interface CartLine {
  cartKey: string;
  productId: number;
  sku: string;
  barcode: string;
  name: string;
  variantName: string;
  quantity: number;
  unitPricePhp: string;
  unitPriceUsd: string;
  unitCostPhp: string;
  unitCostUsd: string;
  availableStock: number;
}

export default function App() {
  // Theme state synced with <html class="dark">
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Mode: Public Landing vs Authenticated Workspace
  const [showPublicPortal, setShowPublicPortal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('POS');

  // Active User, Tenant & Store Context
  const [currentUserId, setCurrentUserId] = useState<number>(2); // Default: Marco Santos (Business Owner, Tenant #1)
  const [overrideTenantId, setOverrideTenantId] = useState<number | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number>(1);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // Connectivity & Offline Simulation Mode
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const isEffectiveOnline = browserOnline && !simulateOffline;

  // Offline Queue & Held Orders in IndexedDB
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedSale[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrderRecord[]>([]);
  const [syncingOffline, setSyncingOffline] = useState<boolean>(false);

  // POS State
  const [posCurrency, setPosCurrency] = useState<CurrencyCode>('PHP');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>('ALL');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [orderDiscountInput, setOrderDiscountInput] = useState<string>('0.00');
  const [applyTax, setApplyTax] = useState<boolean>(true);
  const [applyServiceCharge, setApplyServiceCharge] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'WALLET' | 'BANK_TRANSFER' | 'SPLIT'>('CASH');
  const [amountTenderedInput, setAmountTenderedInput] = useState<string>('');
  const [splitCashInput, setSplitCashInput] = useState<string>('500.00');
  const [posNotes, setPosNotes] = useState<string>('');

  // Modals
  const [activeReceiptSale, setActiveReceiptSale] = useState<any | null>(null);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState<any | null>(null);

  // Inventory & PO Sub-states
  const [invSubTab, setInvSubTab] = useState<'CATALOG' | 'LEDGER' | 'TRANSFER' | 'PO'>('CATALOG');
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [prodForm, setProdForm] = useState({
    sku: '',
    barcode: '',
    name: '',
    categoryId: 1,
    costPrice: '250.00',
    sellingPrice: '480.00',
    wholesalePrice: '410.00',
    expirationDate: '2027-08-31',
    initialStock: 30,
    minStockLevel: 10,
  });
  const [adjustForm, setAdjustForm] = useState({
    productId: 1,
    movementType: 'STOCK_IN',
    quantity: 15,
    notes: 'Supplier restock delivery',
  });
  const [transferForm, setTransferForm] = useState({
    fromStoreId: 3,
    toStoreId: 1,
    productId: 1,
    quantity: 10,
    notes: 'Replenish flagship store from central warehouse',
  });
  const [poForm, setPoForm] = useState({
    supplierId: 1,
    productId: 1,
    quantity: 25,
    notes: 'Scheduled inventory replenishment',
  });

  // Cash Register State
  const [regOpenFloat, setRegOpenFloat] = useState<string>('5000.00');
  const [regMoveType, setRegMoveType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [regMoveAmount, setRegMoveAmount] = useState<string>('500.00');
  const [regMoveReason, setRegMoveReason] = useState<string>('Petty cash / change replenishment');
  const [regActualClose, setRegActualClose] = useState<string>('');

  // Reports Filter State
  const [reportType, setReportType] = useState<
    'OVERVIEW' | 'BY_STORE' | 'BY_CASHIER' | 'BY_PRODUCT' | 'BY_CATEGORY' | 'TAX_REFUNDS'
  >('OVERVIEW');
  const [reportCurrencyFilter, setReportCurrencyFilter] = useState<'SEPARATED' | 'PHP_ONLY' | 'USD_ONLY' | 'CONVERTED_SNAPSHOT'>('SEPARATED');

  // Customer & Supplier Forms
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', discountRate: '5.00' });
  const [newSupplier, setNewSupplier] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '' });

  // Settings Forms
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    taxIdTin: '',
    primaryCurrency: 'PHP',
    allowNegativeStock: false,
    defaultTaxRate: '12.00',
    defaultServiceChargeRate: '5.00',
    usdToPhpRate: '58.50',
    receiptHeader: '',
    receiptFooter: '',
  });
  const [newStoreForm, setNewStoreForm] = useState({ code: '', name: '', address: '', phone: '', isWarehouse: false });
  const [newStaffForm, setNewStaffForm] = useState({ name: '', email: '', roleCode: 'CASHIER', pinCode: '5555' });

  const notify = useCallback((type: 'success' | 'warning' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const fetchBootstrap = useCallback(async () => {
    try {
      const headers: Record<string, string> = {
        'x-user-id': String(currentUserId),
      };
      if (overrideTenantId) {
        headers['x-tenant-id'] = String(overrideTenantId);
      }
      const res = await fetch(`/api/bootstrap?storeId=${selectedStoreId}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch workspace state');
      const payload = await res.json();
      setData(payload);

      if (payload.activeTenant) {
        setSettingsForm({
          name: payload.activeTenant.name || '',
          taxIdTin: payload.activeTenant.tax_id_tin || '',
          primaryCurrency: payload.activeTenant.primary_currency || 'PHP',
          allowNegativeStock: Boolean(payload.activeTenant.allow_negative_stock),
          defaultTaxRate: payload.activeTenant.default_tax_rate || '12.00',
          defaultServiceChargeRate: payload.activeTenant.default_service_charge_rate || '0.00',
          usdToPhpRate: payload.exchangeRates?.[0]?.rate || '58.50',
          receiptHeader: payload.activeTenant.receipt_header || '',
          receiptFooter: payload.activeTenant.receipt_footer || '',
        });
      }

      if (payload.products && payload.activeTenant) {
        await saveOfflineCatalogCache(payload.activeTenant.id, payload.activeStoreId, payload.products);
      }
      const q = await getOfflineSalesQueue(payload.activeTenant?.id);
      setOfflineQueue(q);
      const held = await getHeldOrders(payload.activeTenant?.id || 1);
      setHeldOrders(held);
    } catch {
      // Fallback to IndexedDB cached catalog if offline
      const cachedProducts = await getOfflineCatalogCache(1, selectedStoreId);
      if (cachedProducts && data) {
        setData({ ...data, products: cachedProducts });
      }
    } finally {
      setLoading(false);
    }
  }, [currentUserId, overrideTenantId, selectedStoreId]);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  // Listen to browser online/offline transitions
  useEffect(() => {
    const onOnline = () => {
      setBrowserOnline(true);
      notify('success', 'Internet connection restored. Ready to synchronize offline sales queue.');
    };
    const onOffline = () => {
      setBrowserOnline(false);
      notify('warning', 'Offline Mode active — POS sales will be stored in IndexedDB with UUID idempotency keys.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [notify]);

  const products = useMemo(() => data?.products || [], [data]);
  const categories = useMemo(() => data?.categories || [], [data]);
  const stores = useMemo(() => data?.stores || [], [data]);
  const customers = useMemo(() => data?.customers || [], [data]);
  const suppliers = useMemo(() => data?.suppliers || [], [data]);
  const sales = useMemo(() => data?.sales || [], [data]);
  const activeTenant = data?.activeTenant;
  const currentUser = data?.currentUser;
  const activeStore = stores.find((s: any) => s.id === (data?.activeStoreId || selectedStoreId)) || stores[0];
  const currentExchangeRate = data?.exchangeRates?.[0]?.rate || '58.50';

  // Add item to POS Cart
  const addToCart = useCallback(
    (product: any, variantName = 'Standard', variantDeltaPhp = '0.00') => {
      const basePhp = addDecimal(product.selling_price, variantDeltaPhp);
      const deltaUsd =
        toCents(variantDeltaPhp) > 0
          ? fromCents(Math.round((toCents(variantDeltaPhp) * 100) / toCents(currentExchangeRate)))
          : '0.00';
      const baseUsd = addDecimal(product.selling_price_usd, deltaUsd);
      const cartKey = `${product.id}__${variantName}`;

      setCart((prev) => {
        const existing = prev.find((c) => c.cartKey === cartKey);
        if (existing) {
          if (
            !isEffectiveOnline ||
            activeTenant?.allow_negative_stock ||
            existing.quantity + 1 <= product.store_stock
          ) {
            return prev.map((c) => (c.cartKey === cartKey ? { ...c, quantity: c.quantity + 1 } : c));
          } else {
            notify(
              'warning',
              `Stock limit reached for ${product.name} (${product.store_stock} available in store).`
            );
            return prev;
          }
        }
        if (isEffectiveOnline && !activeTenant?.allow_negative_stock && product.store_stock <= 0) {
          notify('warning', `${product.name} is out of stock in ${activeStore?.name}.`);
          return prev;
        }
        return [
          ...prev,
          {
            cartKey,
            productId: product.id,
            sku: product.sku,
            barcode: product.barcode,
            name: product.name,
            variantName,
            quantity: 1,
            unitPricePhp: basePhp,
            unitPriceUsd: baseUsd,
            unitCostPhp: product.cost_price,
            unitCostUsd: product.cost_price_usd,
            availableStock: product.store_stock,
          },
        ];
      });
    },
    [activeStore?.name, activeTenant?.allow_negative_stock, currentExchangeRate, isEffectiveOnline, notify]
  );

  // Handle Barcode Detection (Camera or USB Scanner)
  const handleBarcodeDetected = useCallback(
    (code: string) => {
      const normalized = code.trim();
      const matched = products.find(
        (p: any) => p.barcode === normalized || p.sku.toLowerCase() === normalized.toLowerCase()
      );
      if (matched) {
        addToCart(matched, matched.variants?.[0]?.name || 'Standard', matched.variants?.[0]?.priceDelta || '0.00');
        notify('success', `Scanned ${matched.name} (${matched.barcode})`);
      } else {
        notify('error', `No product found matching barcode "${normalized}"`);
      }
    },
    [addToCart, notify, products]
  );

  // Filtered POS Catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const matchesCat = selectedCategoryId === 'ALL' || p.category_id === selectedCategoryId;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Exact Decimal Cart Calculations
  const cartSummary = useMemo(() => {
    let subtotal = '0.00';
    let cogs = '0.00';
    for (const line of cart) {
      const unitPrice = posCurrency === 'USD' ? line.unitPriceUsd : line.unitPricePhp;
      const unitCost = posCurrency === 'USD' ? line.unitCostUsd : line.unitCostPhp;
      subtotal = addDecimal(subtotal, mulDecimal(unitPrice, line.quantity));
      cogs = addDecimal(cogs, mulDecimal(unitCost, line.quantity));
    }

    // Apply customer discount rate if selected customer has a discount
    const selectedCust = customers.find((c: any) => c.id === selectedCustomerId);
    const custDisc =
      selectedCust && toCents(selectedCust.discount_rate) > 0
        ? calcPercentage(subtotal, selectedCust.discount_rate)
        : '0.00';

    const manualDisc = fromCents(toCents(orderDiscountInput || '0.00'));
    const discountTotal = addDecimal(custDisc, manualDisc);
    const taxable = compareDecimal(subtotal, discountTotal) > 0 ? subDecimal(subtotal, discountTotal) : '0.00';
    const taxRate = applyTax ? activeTenant?.default_tax_rate || '12.00' : '0.00';
    const taxTotal = applyTax ? calcPercentage(taxable, taxRate) : '0.00';
    const serviceCharge = applyServiceCharge
      ? calcPercentage(taxable, activeTenant?.default_service_charge_rate || '5.00')
      : '0.00';
    const grandTotal = addDecimal(addDecimal(taxable, taxTotal), serviceCharge);

    const effectiveTendered =
      amountTenderedInput.trim() !== '' ? fromCents(toCents(amountTenderedInput)) : grandTotal;
    const changeDue =
      paymentMethod === 'CASH' && compareDecimal(effectiveTendered, grandTotal) > 0
        ? subDecimal(effectiveTendered, grandTotal)
        : '0.00';

    return {
      subtotal,
      discountTotal,
      taxRate,
      taxTotal,
      serviceCharge,
      grandTotal,
      cogs,
      effectiveTendered,
      changeDue,
    };
  }, [
    cart,
    posCurrency,
    customers,
    selectedCustomerId,
    orderDiscountInput,
    applyTax,
    applyServiceCharge,
    activeTenant,
    amountTenderedInput,
    paymentMethod,
  ]);

  //Synchronize Offline Queue with Server
  const handleSyncOfflineQueue = useCallback(async () => {
    const pending = offlineQueue.filter((q) => q.syncStatus === 'PENDING_SYNC' || q.syncStatus === 'FAILED');
    if (pending.length === 0) {
      notify('success', 'All offline transactions are already synchronized.');
      return;
    }
    if (!isEffectiveOnline) {
      notify('warning', 'Cannot synchronize while Offline Mode is active. Switch to Online first.');
      return;
    }

    setSyncingOffline(true);
    try {
      const res = await fetch('/api/pos/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(currentUserId),
        },
        body: JSON.stringify({ transactions: pending }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Sync request failed');

      let conflictCount = 0;
      for (const itemRes of result.results || []) {
        if (itemRes.status === 'CONFLICT_FLAGGED') conflictCount++;
        await updateOfflineSaleStatus(itemRes.clientUuid, {
          syncStatus: itemRes.status === 'CONFLICT_FLAGGED' ? 'CONFLICT_FLAGGED' : 'SYNCHRONIZED',
          serverTransactionNumber: itemRes.transactionNumber,
          syncedAt: new Date().toISOString(),
        });
      }

      await fetchBootstrap();
      if (conflictCount > 0) {
        notify(
          'warning',
          `Synchronized ${result.syncedCount} offline sale(s). ${conflictCount} sale(s) flagged an inventory variance for manager review.`
        );
      } else {
        notify('success', `Successfully synchronized ${result.syncedCount} offline transaction(s) with idempotency verification.`);
      }
    } catch (err: any) {
      notify('error', err.message || 'Offline synchronization failed');
    } finally {
      setSyncingOffline(false);
    }
  }, [offlineQueue, isEffectiveOnline, currentUserId, fetchBootstrap, notify]);

  // Automatically sync when returning online if pending items exist
  useEffect(() => {
    const hasPending = offlineQueue.some((q) => q.syncStatus === 'PENDING_SYNC');
    if (isEffectiveOnline && hasPending && !syncingOffline) {
      handleSyncOfflineQueue();
    }
  }, [isEffectiveOnline, offlineQueue, syncingOffline, handleSyncOfflineQueue]);

  // Complete POS Checkout (Online or Offline Queue)
  async function handleCompleteSale() {
    if (cart.length === 0) {
      notify('warning', 'Add at least one item to the shopping cart before checkout.');
      return;
    }

    const clientUuid = crypto.randomUUID();
    const paymentsList =
      paymentMethod === 'SPLIT'
        ? [
            { method: 'CASH', amount: fromCents(toCents(splitCashInput)), reference: 'SPLIT-CASH' },
            {
              method: 'CARD',
              amount:
                compareDecimal(cartSummary.grandTotal, splitCashInput) > 0
                  ? subDecimal(cartSummary.grandTotal, splitCashInput)
                  : '0.00',
              reference: `SPLIT-CARD-${clientUuid.slice(0, 6).toUpperCase()}`,
            },
          ]
        : [
            {
              method: paymentMethod,
              amount: cartSummary.grandTotal,
              reference: paymentMethod === 'CASH' ? 'CASH-DRAWER' : `${paymentMethod}-${clientUuid.slice(0, 6).toUpperCase()}`,
            },
          ];

    // OFFLINE PATH: Queue in IndexedDB + generate instant offline receipt
    if (!isEffectiveOnline) {
      const offlineRecord: OfflineQueuedSale = {
        clientUuid,
        tenantId: activeTenant?.id || 1,
        storeId: activeStore?.id || 1,
        terminalId: data?.terminals?.[0]?.id || 1,
        customerId: selectedCustomerId,
        currencyCode: posCurrency,
        exchangeRateSnapshot: currentExchangeRate,
        subtotal: cartSummary.subtotal,
        orderDiscountAmount: cartSummary.discountTotal,
        taxTotal: cartSummary.taxTotal,
        serviceCharge: cartSummary.serviceCharge,
        grandTotal: cartSummary.grandTotal,
        applyTax,
        applyServiceCharge,
        paymentMethod,
        amountTendered: cartSummary.effectiveTendered,
        changeAmount: cartSummary.changeDue,
        payments: paymentsList,
        items: cart.map((c) => {
          const up = posCurrency === 'USD' ? c.unitPriceUsd : c.unitPricePhp;
          const uc = posCurrency === 'USD' ? c.unitCostUsd : c.unitCostPhp;
          return {
            productId: c.productId,
            sku: c.sku,
            productName: c.name,
            variantName: c.variantName,
            quantity: c.quantity,
            unitPrice: up,
            unitCost: uc,
            lineTotal: mulDecimal(up, c.quantity),
          };
        }),
        syncStatus: 'PENDING_SYNC',
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };

      await enqueueOfflineSale(offlineRecord);
      const updatedQueue = await getOfflineSalesQueue(activeTenant?.id || 1);
      setOfflineQueue(updatedQueue);

      setCart([]);
      setAmountTenderedInput('');
      setOrderDiscountInput('0.00');
      setActiveReceiptSale({
        ...offlineRecord,
        transaction_number: `OFFLINE-${clientUuid.slice(0, 8).toUpperCase()}`,
        currency_code: posCurrency,
        grand_total: offlineRecord.grandTotal,
        discount_total: offlineRecord.orderDiscountAmount,
        tax_total: offlineRecord.taxTotal,
        tax_rate_snapshot: cartSummary.taxRate,
        amount_tendered: offlineRecord.amountTendered,
        change_amount: offlineRecord.changeAmount,
        cashier_name: currentUser?.name,
        sync_source: 'OFFLINE_QUEUED (UUID)',
      });
      notify(
        'warning',
        `Sale saved to Offline IndexedDB Queue (${formatMoney(offlineRecord.grandTotal, posCurrency)}). Will auto-sync when online.`
      );
      return;
    }

    // ONLINE PATH: Commit ACID transaction to backend
    try {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(currentUserId),
        },
        body: JSON.stringify({
          clientUuid,
          storeId: activeStore?.id || 1,
          terminalId: data?.terminals?.[0]?.id || 1,
          customerId: selectedCustomerId,
          currencyCode: posCurrency,
          items: cart.map((c) => ({
            productId: c.productId,
            variantName: c.variantName,
            quantity: c.quantity,
          })),
          orderDiscountAmount: cartSummary.discountTotal,
          applyTax,
          applyServiceCharge,
          paymentMethod,
          amountTendered: cartSummary.effectiveTendered,
          payments: paymentsList,
          notes: posNotes,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Checkout failed');

      setCart([]);
      setAmountTenderedInput('');
      setOrderDiscountInput('0.00');
      setPosNotes('');
      setActiveReceiptSale(result.sale);
      await fetchBootstrap();
      notify(
        'success',
        `Sale ${result.sale.transaction_number} completed (${formatMoney(result.sale.grand_total, posCurrency)}).`
      );
    } catch (err: any) {
      notify('error', err.message || 'Transaction error');
    }
  }

  // Hold / Park Current Order in IndexedDB
  async function handleHoldCurrentOrder() {
    if (cart.length === 0) return;
    const cust = customers.find((c: any) => c.id === selectedCustomerId);
    const holdRecord: HeldOrderRecord = {
      holdId: `HOLD-${Date.now().toString().slice(-6)}`,
      tenantId: activeTenant?.id || 1,
      storeId: activeStore?.id || 1,
      customerName: cust ? cust.name : 'Walk-In Customer',
      customerId: selectedCustomerId,
      currencyCode: posCurrency,
      note: posNotes || `${cart.length} item(s)`,
      items: cart.map((c) => ({
        productId: c.productId,
        sku: c.sku,
        name: c.name,
        variantName: c.variantName,
        quantity: c.quantity,
        unitPricePhp: c.unitPricePhp,
        unitPriceUsd: c.unitPriceUsd,
        unitCostPhp: c.unitCostPhp,
        unitCostUsd: c.unitCostUsd,
      })),
      heldAt: new Date().toISOString(),
    };
    await saveHeldOrder(holdRecord);
    setHeldOrders(await getHeldOrders(activeTenant?.id || 1));
    setCart([]);
    notify('success', `Order parked as ${holdRecord.holdId}. Resume anytime.`);
  }

  async function handleResumeHeldOrder(held: HeldOrderRecord) {
    setPosCurrency(held.currencyCode);
    setSelectedCustomerId(held.customerId);
    setCart(
      held.items.map((it) => ({
        cartKey: `${it.productId}__${it.variantName}`,
        productId: it.productId,
        sku: it.sku,
        barcode: it.sku,
        name: it.name,
        variantName: it.variantName,
        quantity: it.quantity,
        unitPricePhp: it.unitPricePhp,
        unitPriceUsd: it.unitPriceUsd,
        unitCostPhp: it.unitCostPhp,
        unitCostUsd: it.unitCostUsd,
        availableStock: 99,
      }))
    );
    await deleteHeldOrder(held.holdId);
    setHeldOrders(await getHeldOrders(activeTenant?.id || 1));
    notify('success', `Resumed held order ${held.holdId}`);
  }

  // Multi-Currency Financial Aggregations for Reports & Analytics
  const financialAnalytics = useMemo(() => {
    const completedSales = sales.filter((s: any) => s.status === 'COMPLETED');
    let phpGross = '0.00';
    let phpDiscount = '0.00';
    let phpTax = '0.00';
    let phpCogs = '0.00';
    let phpProfit = '0.00';
    let phpCount = 0;

    let usdGross = '0.00';
    let usdDiscount = '0.00';
    let usdTax = '0.00';
    let usdCogs = '0.00';
    let usdProfit = '0.00';
    let usdCount = 0;

    let convertedPhpSnapshotTotal = '0.00';

    for (const s of completedSales) {
      if (s.currency_code === 'USD') {
        usdCount++;
        usdGross = addDecimal(usdGross, s.grand_total);
        usdDiscount = addDecimal(usdDiscount, s.discount_total);
        usdTax = addDecimal(usdTax, s.tax_total);
        usdCogs = addDecimal(usdCogs, s.cogs_total);
        usdProfit = addDecimal(usdProfit, s.profit_total);
        // Convert using historical rate snapshot saved at time of sale
        const snapPhp = convertWithRateSnapshot(s.grand_total, s.exchange_rate_snapshot || '58.50');
        convertedPhpSnapshotTotal = addDecimal(convertedPhpSnapshotTotal, snapPhp);
      } else {
        phpCount++;
        phpGross = addDecimal(phpGross, s.grand_total);
        phpDiscount = addDecimal(phpDiscount, s.discount_total);
        phpTax = addDecimal(phpTax, s.tax_total);
        phpCogs = addDecimal(phpCogs, s.cogs_total);
        phpProfit = addDecimal(phpProfit, s.profit_total);
        convertedPhpSnapshotTotal = addDecimal(convertedPhpSnapshotTotal, s.grand_total);
      }
    }

    // Inventory Valuation (at cost and retail)
    let invCostValuationPhp = '0.00';
    let invRetailValuationPhp = '0.00';
    for (const row of data?.inventoryMatrix || []) {
      if (row.stock_quantity > 0) {
        invCostValuationPhp = addDecimal(invCostValuationPhp, mulDecimal(row.cost_price, row.stock_quantity));
        invRetailValuationPhp = addDecimal(invRetailValuationPhp, mulDecimal(row.selling_price, row.stock_quantity));
      }
    }

    const lowStockProducts = products.filter((p: any) => p.store_stock <= p.min_stock_level);

    return {
      phpCount,
      phpGross,
      phpDiscount,
      phpTax,
      phpCogs,
      phpProfit,
      usdCount,
      usdGross,
      usdDiscount,
      usdTax,
      usdCogs,
      usdProfit,
      convertedPhpSnapshotTotal,
      invCostValuationPhp,
      invRetailValuationPhp,
      lowStockProducts,
    };
  }, [sales, data?.inventoryMatrix, products]);

  // CSV Export Helper
  function handleExportSalesCsv() {
    const headers = [
      'Transaction_No',
      'Date',
      'Store',
      'Cashier',
      'Currency',
      'Exchange_Rate_Snapshot',
      'Subtotal',
      'Discount',
      'Tax',
      'Grand_Total',
      'COGS',
      'Net_Profit',
      'Payment_Method',
      'Status',
    ];
    const rows = sales.map((s: any) =>
      [
        s.transaction_number,
        s.created_at,
        `"${s.store_name}"`,
        `"${s.cashier_name}"`,
        s.currency_code,
        s.exchange_rate_snapshot,
        s.subtotal,
        s.discount_total,
        s.tax_total,
        s.grand_total,
        s.cogs_total,
        s.profit_total,
        s.payment_method,
        s.status,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartpos-sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Initializing SMARTPOS Multi-Tenant Workspace...
          </p>
        </div>
      </div>
    );
  }

  if (showPublicPortal) {
    return (
      <PublicSaaSPortal
        subscriptionPlans={data?.subscriptionPlans || []}
        demoUsers={data?.demoUsers || []}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onSelectDemoUser={(uid, targetTab) => {
          setCurrentUserId(uid);
          setOverrideTenantId(null);
          if (targetTab) setActiveTab(targetTab as WorkspaceTab);
          setShowPublicPortal(false);
        }}
        onLoginSuccess={(uid) => {
          setCurrentUserId(uid);
          setOverrideTenantId(null);
          setShowPublicPortal(false);
        }}
        onEnterWorkspace={() => setShowPublicPortal(false)}
      />
    );
  }

  const pendingOfflineCount = offlineQueue.filter((q) => q.syncStatus === 'PENDING_SYNC').length;
  const conflictSales = sales.filter((s: any) => Number(s.has_inventory_conflict) === 1);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Mandatory 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#pos"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('POS');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 font-display"
        >
          SMARTPOS
        </a>

        {/* Zone 2: 4–5 single-line text navigation links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => setActiveTab('POS')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'POS' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            POS Terminal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('INVENTORY')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'INVENTORY' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            Inventory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('REGISTER')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'REGISTER' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            Cash Register
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DASHBOARD')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'DASHBOARD' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''
            }`}
          >
            Reports
          </button>
          <button
            type="button"
            onClick={() => setShowPublicPortal(true)}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Public SaaS Site
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/api/export/laravel-zip"
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Production ZIP</span>
          </a>
        </div>
      </header>

      {/* Workspace Context & Role/Store/Offline Toolbar */}
      <div className="bg-slate-100/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 px-5 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Active Tenant, Role Persona Switcher & Store Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-slate-900 dark:text-white">
                {activeTenant?.name}
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">
                Plan: {activeTenant?.plan_code}
              </span>
            </div>

            <select
              aria-label="Active User Role Persona"
              value={currentUserId}
              onChange={(e) => {
                const uid = Number(e.target.value);
                setCurrentUserId(uid);
                setOverrideTenantId(null);
              }}
              className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
            >
              {(data?.demoUsers || []).map((u: any) => (
                <option key={u.id} value={u.id}>
                  Role: {u.role_code} — {u.name.split(' (')[0]} ({u.tenant_name || 'Global Platform'})
                </option>
              ))}
            </select>

            <select
              aria-label="Active Store Branch"
              value={activeStore?.id || 1}
              onChange={(e) => setSelectedStoreId(Number(e.target.value))}
              className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
            >
              {stores.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.is_warehouse ? 'Warehouse' : 'Store'}: {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Right: Offline Simulation Toggle, Pending Queue Indicator, PWA Install & Theme Switch */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !simulateOffline;
                setSimulateOffline(next);
                if (next) {
                  notify(
                    'warning',
                    'Offline Simulation Enabled: Sales will now queue locally in IndexedDB with UUIDv4 idempotency tokens.'
                  );
                } else {
                  notify('success', 'Online Mode Restored: Synchronizing pending offline sales...');
                }
              }}
              className={`min-h-[36px] px-3 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                !isEffectiveOnline
                  ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {!isEffectiveOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Offline Mode (Tap to Go Online)</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Online (Simulate Offline)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('OFFLINE_SYNC')}
              className="min-h-[36px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingOffline ? 'animate-spin text-blue-600' : ''}`} />
              <span>Offline Queue: {pendingOfflineCount}</span>
            </button>

            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="min-h-[36px] min-w-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center"
              title="Toggle Light / Dark Mode"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast Banner */}
      {toast && (
        <div
          className={`px-5 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
            toast.type === 'error'
              ? 'bg-red-600 text-white border-red-700'
              : toast.type === 'warning'
              ? 'bg-amber-500 text-slate-950 border-amber-600'
              : 'bg-emerald-600 text-white border-emerald-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'error' || toast.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button type="button" onClick={() => setToast(null)} className="underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Desktop Sidebar + Content Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar (250px on Desktop) */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-3 overflow-y-auto">
          <div className="space-y-5">
            <div>
              <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5">
                Store & Terminal Operations
              </p>
              <div className="space-y-1">
                {[
                  { id: 'POS', label: 'Touch POS Terminal', icon: ShoppingCart },
                  { id: 'OFFLINE_SYNC', label: `Offline Sync (${pendingOfflineCount})`, icon: WifiOff },
                  { id: 'INVENTORY', label: 'Inventory & PO Ledger', icon: Package },
                  { id: 'REGISTER', label: 'Cash Register Drawer', icon: Vault },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id as WorkspaceTab)}
                      className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5">
                Business Management
              </p>
              <div className="space-y-1">
                {[
                  { id: 'DASHBOARD', label: 'Multi-Currency Reports', icon: BarChart3 },
                  { id: 'CUSTOMERS', label: 'Customers & Suppliers', icon: Users },
                  { id: 'SUBSCRIPTION', label: 'SaaS Subscription', icon: CreditCard },
                  { id: 'SETTINGS', label: 'Business & RBAC Settings', icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id as WorkspaceTab)}
                      className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5">
                Platform & DevOps QA
              </p>
              <div className="space-y-1">
                {[
                  { id: 'SUPERADMIN', label: 'Superadmin Tenants', icon: Globe },
                  { id: 'INSTALLER', label: '9-Step Install Wizard', icon: ShieldCheck },
                  { id: 'BACKUPS', label: 'Backups & Verification', icon: ArrowLeftRight },
                  { id: 'TESTS', label: 'Automated QA Tests', icon: CheckCircle2 },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id as WorkspaceTab)}
                      className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {currentUser?.name}
            </div>
            <div className="font-mono text-slate-500">
              Role: {currentUser?.role_code} · Rate: 1 USD = ₱{currentExchangeRate}
            </div>
          </div>
        </aside>

        {/* Main Workspace Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-8">
          {/* ===================================================================== */}
          {/* VIEW 1: TOUCH POS TERMINAL                                            */}
          {/* ===================================================================== */}
          {activeTab === 'POS' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left 7 Columns: Search, Barcode Scanner, Categories & Product Touch Grid */}
              <div className="xl:col-span-7 space-y-4">
                {/* Search + Barcode + Currency Bar */}
                <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchQuery.trim()) {
                          handleBarcodeDetected(searchQuery.trim());
                          setSearchQuery('');
                        }
                      }}
                      placeholder="Search product name, SKU, or scan USB barcode + Enter..."
                      className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowScannerModal(true)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 hover:opacity-95 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <ScanBarcode className="w-4 h-4" />
                    <span>Scan Barcode</span>
                  </button>

                  {/* Transaction Currency Switcher (PHP vs USD) */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                    {(['PHP', 'USD'] as const).map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setPosCurrency(curr)}
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
                          posCurrency === curr
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {curr === 'PHP' ? 'PHP (₱)' : 'USD ($)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('ALL')}
                    className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selectedCategoryId === 'ALL'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    All Products ({products.length})
                  </button>
                  {categories.map((cat: any) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        selectedCategoryId === cat.id
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Touch Product Catalog Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {filteredProducts.map((product: any) => {
                    const price = posCurrency === 'USD' ? product.selling_price_usd : product.selling_price;
                    const isLowStock = product.store_stock <= product.min_stock_level;
                    const hasVariants = Array.isArray(product.variants) && product.variants.length > 1;

                    return (
                      <div
                        key={product.id}
                        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
                      >
                        <div>
                          <div className="relative h-32 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <img
                              src={product.image_url || '/src/assets/images/product_espresso_blend_1794314139623.jpg'}
                              alt={product.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="p-3.5 space-y-1">
                            {/* Clean unboxed metadata per Zero-Pill rule */}
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                              {product.sku} · {product.barcode}
                            </div>
                            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">
                              {product.name}
                            </h3>
                            <div className="pt-1 flex items-baseline justify-between gap-2 tabular-nums">
                              <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                                {formatMoney(price, posCurrency)}
                              </span>
                              <span
                                className={`text-[11px] font-mono ${
                                  product.store_stock <= 0
                                    ? 'text-red-600 dark:text-red-400 font-semibold'
                                    : isLowStock
                                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                Stock: {product.store_stock}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 pt-0 flex gap-2">
                          <button
                            type="button"
                            onClick={() => addToCart(product, product.variants?.[0]?.name || 'Standard', '0.00')}
                            className="flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                          {hasVariants && (
                            <button
                              type="button"
                              onClick={() => setVariantPickerProduct(product)}
                              className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
                            >
                              Variants
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Held / Parked Orders Bar */}
                {heldOrders.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <PauseCircle className="w-4 h-4 text-amber-500" />
                      <span>Held Orders Ready to Resume ({heldOrders.length})</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {heldOrders.map((h) => (
                        <div
                          key={h.holdId}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3 text-xs"
                        >
                          <div>
                            <span className="font-mono font-semibold">{h.holdId}</span> · {h.customerName} ({h.items.length} items)
                          </div>
                          <button
                            type="button"
                            onClick={() => handleResumeHeldOrder(h)}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-blue-600 text-white font-medium flex items-center gap-1"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Resume</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right 5 Columns: Shopping Cart, Customer, Discounts, Tender & Checkout */}
              <div className="xl:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Current Sale Register Ticket ({posCurrency})
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {activeStore?.name} · Rate Snapshot: 1 USD = ₱{currentExchangeRate}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleHoldCurrentOrder}
                      disabled={cart.length === 0}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      <span>Hold</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      disabled={cart.length === 0}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Customer Selector */}
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Customer & Loyalty Account
                  </label>
                  <select
                    value={selectedCustomerId || ''}
                    onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  >
                    <option value="">Walk-In Retail Customer (Standard Pricing)</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.loyalty_points} pts {Number(c.discount_rate) > 0 ? `· ${c.discount_rate}% VIP Discount` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cart Line Items */}
                <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto px-5">
                  {cart.length === 0 ? (
                    <div className="py-10 text-center space-y-2 text-xs text-slate-500 dark:text-slate-400">
                      <ShoppingCart className="w-7 h-7 text-slate-400 mx-auto" />
                      <p>Cart is empty. Tap any product tile or scan a barcode to begin checkout.</p>
                    </div>
                  ) : (
                    cart.map((line) => {
                      const unitPrice = posCurrency === 'USD' ? line.unitPriceUsd : line.unitPricePhp;
                      const lineTotal = mulDecimal(unitPrice, line.quantity);
                      return (
                        <div key={line.cartKey} className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {line.name}
                            </p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {line.variantName} · {formatMoney(unitPrice, posCurrency)} / unit
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setCart((prev) =>
                                  prev
                                    .map((c) => (c.cartKey === line.cartKey ? { ...c, quantity: c.quantity - 1 } : c))
                                    .filter((c) => c.quantity > 0)
                                )
                              }
                              className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-7 text-center font-mono text-xs font-bold tabular-nums">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCart((prev) =>
                                  prev.map((c) => (c.cartKey === line.cartKey ? { ...c, quantity: c.quantity + 1 } : c))
                                )
                              }
                              className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="w-20 text-right font-mono text-xs font-semibold tabular-nums shrink-0">
                            {formatMoney(lineTotal, posCurrency)}
                          </div>

                          <button
                            type="button"
                            onClick={() => setCart((prev) => prev.filter((c) => c.cartKey !== line.cartKey))}
                            className="min-h-[38px] min-w-[38px] rounded-lg text-slate-400 hover:text-red-600 flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Discounts, Taxes, Service Charges & Totals */}
                <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-3 text-xs tabular-nums">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Order Discount ({posCurrency})
                      </label>
                      <input
                        type="text"
                        value={orderDiscountInput}
                        onChange={(e) => setOrderDiscountInput(e.target.value)}
                        className="w-full min-h-[38px] px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                      />
                    </div>
                    <div className="flex flex-col justify-end gap-1.5">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyTax}
                          onChange={(e) => setApplyTax(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span>Apply Tax ({activeTenant?.default_tax_rate || '12.00'}%)</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyServiceCharge}
                          onChange={(e) => setApplyServiceCharge(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span>Service Charge ({activeTenant?.default_service_charge_rate || '5.00'}%)</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatMoney(cartSummary.subtotal, posCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Total Discounts</span>
                      <span className="font-mono">-{formatMoney(cartSummary.discountTotal, posCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Tax ({cartSummary.taxRate}%)</span>
                      <span className="font-mono">{formatMoney(cartSummary.taxTotal, posCurrency)}</span>
                    </div>
                    {toCents(cartSummary.serviceCharge) > 0 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Service Charge</span>
                        <span className="font-mono">{formatMoney(cartSummary.serviceCharge, posCurrency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-slate-800">
                      <span>Grand Total</span>
                      <span className="font-mono">{formatMoney(cartSummary.grandTotal, posCurrency)}</span>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="pt-2 space-y-2">
                    <label className="block text-[11px] font-medium text-slate-500">
                      Payment Tender Method
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'CASH', label: 'Cash', icon: Banknote },
                        { id: 'CARD', label: 'Card', icon: CreditCard },
                        { id: 'WALLET', label: 'Wallet', icon: Wallet },
                        { id: 'SPLIT', label: 'Split', icon: Split },
                      ].map((pm) => {
                        const Icon = pm.icon;
                        return (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => setPaymentMethod(pm.id as any)}
                            className={`min-h-[44px] p-2 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-colors ${
                              paymentMethod === pm.id
                                ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{pm.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {paymentMethod === 'CASH' && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Cash Tendered ({posCurrency})
                        </label>
                        <input
                          type="text"
                          placeholder={cartSummary.grandTotal}
                          value={amountTenderedInput}
                          onChange={(e) => setAmountTenderedInput(e.target.value)}
                          className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between">
                          <span className="text-[11px] text-emerald-800 dark:text-emerald-300">Change:</span>
                          <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-300">
                            {formatMoney(cartSummary.changeDue, posCurrency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'SPLIT' && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Cash Portion ({posCurrency})
                        </label>
                        <input
                          type="text"
                          value={splitCashInput}
                          onChange={(e) => setSplitCashInput(e.target.value)}
                          className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Remaining Card Portion
                        </label>
                        <div className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 font-mono text-xs">
                          {formatMoney(
                            compareDecimal(cartSummary.grandTotal, splitCashInput) > 0
                              ? subDecimal(cartSummary.grandTotal, splitCashInput)
                              : '0.00',
                            posCurrency
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCompleteSale}
                    className="w-full min-h-[50px] mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      {isEffectiveOnline
                        ? `Complete Sale & Print Receipt (${formatMoney(cartSummary.grandTotal, posCurrency)})`
                        : `Queue Offline Sale & Print Receipt (${formatMoney(cartSummary.grandTotal, posCurrency)})`}
                    </span>
                  </button>
                </div>

                {/* Recent Store Transactions & Quick Receipt / Refund Actions */}
                <div className="p-5 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                    Recent POS Transactions (Receipt Reprint, Refund & Void)
                  </h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {sales.slice(0, 6).map((s: any) => (
                      <div
                        key={s.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs tabular-nums"
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-semibold text-slate-900 dark:text-white">
                            {s.transaction_number} · {formatMoney(s.grand_total, s.currency_code)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {s.payment_method} · {s.status} · {s.sync_source}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setActiveReceiptSale(s)}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-[11px] font-medium flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Receipt</span>
                          </button>
                          {s.status === 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await fetch('/api/pos/refund', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'x-user-id': String(currentUserId),
                                  },
                                  body: JSON.stringify({
                                    saleId: s.id,
                                    reason: 'Customer return & restock',
                                    restockItems: true,
                                    mode: 'REFUND',
                                  }),
                                });
                                if (res.ok) {
                                  await fetchBootstrap();
                                  notify('success', `Refunded ${s.transaction_number} and restocked items.`);
                                }
                              }}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-red-500 text-red-600 dark:text-red-400 text-[11px] font-medium flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Refund</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* VIEW 2: OFFLINE-FIRST PWA QUEUE & CONFLICT RESOLUTION                 */}
          {/* ===================================================================== */}
          {activeTab === 'OFFLINE_SYNC' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Offline-First IndexedDB Synchronization & Conflict Resolution Center
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Offline transactions use client-generated UUIDv4 idempotency keys. Offline sales never silently overwrite server stock — discrepancies are flagged for manager resolution.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSimulateOffline(!simulateOffline)}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  >
                    {simulateOffline ? 'Switch to Online Mode' : 'Simulate Offline Outage'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncOfflineQueue}
                    disabled={syncingOffline}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncingOffline ? 'animate-spin' : ''}`} />
                    <span>Synchronize Pending Queue ({pendingOfflineCount})</span>
                  </button>
                </div>
              </div>

              {/* Flagged Server Stock Conflicts Requiring Manager Review */}
              {conflictSales.length > 0 && (
                <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-sm font-bold">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Offline Inventory Conflict Detected ({conflictSales.length}) — Manual Review Required</span>
                  </div>
                  <div className="space-y-2">
                    {conflictSales.map((cs: any) => (
                      <div
                        key={cs.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-slate-900 dark:text-white">
                            {cs.transaction_number} · UUID: {cs.client_uuid}
                          </div>
                          <div className="text-amber-700 dark:text-amber-300 mt-0.5">{cs.conflict_notes}</div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch('/api/pos/resolve-conflict', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': String(currentUserId),
                              },
                              body: JSON.stringify({
                                saleId: cs.id,
                                resolutionAction: 'RESTOCK_VARIANCE',
                                notes: 'Physical shelf count reconciled by manager',
                              }),
                            });
                            await fetchBootstrap();
                            notify('success', `Reconciled inventory conflict for ${cs.transaction_number}`);
                          }}
                          className="min-h-[38px] px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                        >
                          Approve & Reconcile Stock Variance
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* IndexedDB Local Queue Table */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Local Browser IndexedDB Queue (smartpos_offline_pwa_db)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/60 dark:bg-slate-950/40">
                        <th className="py-3 px-4 font-medium">Client UUID (Idempotency Key)</th>
                        <th className="py-3 px-4 font-medium">Created Offline</th>
                        <th className="py-3 px-4 font-medium">Items</th>
                        <th className="py-3 px-4 font-medium text-right">Total</th>
                        <th className="py-3 px-4 font-medium">Sync Status</th>
                        <th className="py-3 px-4 font-medium">Server Ack No.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                      {offlineQueue.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No offline transactions queued in IndexedDB yet. Toggle "Simulate Offline" and complete a POS sale to test.
                          </td>
                        </tr>
                      ) : (
                        offlineQueue.map((oq) => (
                          <tr key={oq.clientUuid}>
                            <td className="py-3 px-4 font-mono">{oq.clientUuid}</td>
                            <td className="py-3 px-4 font-mono text-slate-500">
                              {new Date(oq.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              {oq.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold">
                              {formatMoney(oq.grandTotal, oq.currencyCode)}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold">
                              <span
                                className={
                                  oq.syncStatus === 'SYNCHRONIZED'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : oq.syncStatus === 'CONFLICT_FLAGGED'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-blue-600 dark:text-blue-400'
                                }
                              >
                                {oq.syncStatus}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono">{oq.serverTransactionNumber || 'PENDING'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Server Offline Sync Audit Log */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Server Synchronization History & Acknowledgments
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/60 dark:bg-slate-950/40">
                        <th className="py-3 px-4 font-medium">Transaction No.</th>
                        <th className="py-3 px-4 font-medium">Client UUID</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium">Resolution</th>
                        <th className="py-3 px-4 font-medium">Summary</th>
                        <th className="py-3 px-4 font-medium">Synced At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                      {(data?.offlineSyncLogs || []).map((log: any) => (
                        <tr key={log.id}>
                          <td className="py-3 px-4 font-mono font-semibold">{log.transaction_number}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{log.client_uuid.slice(0, 18)}...</td>
                          <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {log.sync_status}
                          </td>
                          <td className="py-3 px-4">{log.conflict_resolution}</td>
                          <td className="py-3 px-4 font-mono">{log.payload_summary}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {new Date(log.synced_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* VIEW 3: INVENTORY MANAGEMENT, AUDITED LEDGER, TRANSFERS & POs         */}
          {/* ===================================================================== */}
          {activeTab === 'INVENTORY' && (
            <div className="space-y-6">
              {/* Sub-navigation & Valuation Header */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'CATALOG', label: 'Product Catalog & Stock' },
                    { id: 'LEDGER', label: 'Stock Adjustments & Ledger' },
                    { id: 'TRANSFER', label: 'Inter-Store Stock Transfers' },
                    { id: 'PO', label: 'Purchase Orders & Receiving' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setInvSubTab(tab.id as any)}
                      className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                        invSubTab === tab.id
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                  <div>
                    <span className="text-slate-500">Cost Valuation: </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatMoney(financialAnalytics.invCostValuationPhp, 'PHP')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Retail Valuation: </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(financialAnalytics.invRetailValuationPhp, 'PHP')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProductModal(true)}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-sans font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Product</span>
                  </button>
                </div>
              </div>

              {invSubTab === 'CATALOG' && (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/60 dark:bg-slate-950/40">
                          <th className="py-3 px-4 font-medium">SKU / Barcode</th>
                          <th className="py-3 px-4 font-medium">Product & Category</th>
                          <th className="py-3 px-4 font-medium text-right">Cost (PHP / USD)</th>
                          <th className="py-3 px-4 font-medium text-right">Retail (PHP / USD)</th>
                          <th className="py-3 px-4 font-medium text-right">Wholesale</th>
                          <th className="py-3 px-4 font-medium text-right">Store Stock</th>
                          <th className="py-3 px-4 font-medium text-right">Total Tenant Stock</th>
                          <th className="py-3 px-4 font-medium">Expiration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                        {products.map((p: any) => {
                          const low = p.store_stock <= p.min_stock_level;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                              <td className="py-3 px-4 font-mono">
                                <div className="font-semibold text-slate-900 dark:text-white">{p.sku}</div>
                                <div className="text-slate-500">{p.barcode}</div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900 dark:text-white">{p.name}</div>
                                <div className="text-slate-500">
                                  {p.category_name} · {p.brand_name || 'House Brand'}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                {formatMoney(p.cost_price, 'PHP')} / {formatMoney(p.cost_price_usd, 'USD')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold">
                                {formatMoney(p.selling_price, 'PHP')} / {formatMoney(p.selling_price_usd, 'USD')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                {formatMoney(p.wholesale_price, 'PHP')}
                              </td>
                              <td className="py-3 px-4 text-right font-mono">
                                <span
                                  className={
                                    low
                                      ? 'text-amber-600 dark:text-amber-400 font-bold'
                                      : 'text-slate-900 dark:text-white font-semibold'
                                  }
                                >
                                  {p.store_stock} {low ? '(LOW)' : ''}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold">
                                {p.total_tenant_stock}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-500">
                                {p.expiration_date || 'Non-perishable'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {invSubTab === 'LEDGER' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left 4 cols: Record Stock In / Out / Adjustment */}
                  <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Record Auditable Stock Movement
                    </h3>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const res = await fetch('/api/inventory/adjust', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'x-user-id': String(currentUserId),
                          },
                          body: JSON.stringify({
                            storeId: activeStore?.id || 1,
                            ...adjustForm,
                          }),
                        });
                        const d = await res.json();
                        if (res.ok) {
                          await fetchBootstrap();
                          notify('success', 'Recorded inventory ledger movement.');
                        } else {
                          notify('error', d.error || 'Failed to adjust inventory');
                        }
                      }}
                      className="space-y-3 text-xs"
                    >
                      <div>
                        <label className="block text-slate-500 mb-1">Product</label>
                        <select
                          value={adjustForm.productId}
                          onChange={(e) => setAdjustForm({ ...adjustForm, productId: Number(e.target.value) })}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          {products.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} — {p.name} (In Store: {p.store_stock})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Movement Type</label>
                        <select
                          value={adjustForm.movementType}
                          onChange={(e) => setAdjustForm({ ...adjustForm, movementType: e.target.value })}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          <option value="STOCK_IN">STOCK_IN (+ Add Units)</option>
                          <option value="STOCK_OUT">STOCK_OUT (- Deduct Spoilage/Damage)</option>
                          <option value="ADJUSTMENT_SET">ADJUSTMENT_SET (= Set Exact Physical Count)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Quantity</label>
                        <input
                          type="number"
                          min={1}
                          value={adjustForm.quantity}
                          onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Audit Notes / Reference</label>
                        <input
                          type="text"
                          required
                          value={adjustForm.notes}
                          onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        Commit Stock Movement
                      </button>
                    </form>
                  </div>

                  {/* Right 8 cols: Immutable Stock Ledger History */}
                  <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Immutable Inventory Movement Ledger
                      </h3>
                    </div>
                    <div className="overflow-x-auto max-h-[500px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/60 dark:bg-slate-950/40">
                            <th className="py-2.5 px-4 font-medium">Reference</th>
                            <th className="py-2.5 px-4 font-medium">Store</th>
                            <th className="py-2.5 px-4 font-medium">Product</th>
                            <th className="py-2.5 px-4 font-medium">Type</th>
                            <th className="py-2.5 px-4 font-medium text-right">Before → Change → After</th>
                            <th className="py-2.5 px-4 font-medium">Notes & Actor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                          {(data?.inventoryMovements || []).map((m: any) => (
                            <tr key={m.id}>
                              <td className="py-2.5 px-4 font-mono font-semibold">{m.reference_number}</td>
                              <td className="py-2.5 px-4">{m.store_name}</td>
                              <td className="py-2.5 px-4">
                                <span className="font-semibold">{m.sku}</span> · {m.product_name}
                              </td>
                              <td className="py-2.5 px-4 font-mono">{m.movement_type}</td>
                              <td className="py-2.5 px-4 text-right font-mono">
                                {m.quantity_before} →{' '}
                                <span
                                  className={
                                    m.quantity_change >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                      : 'text-red-600 dark:text-red-400 font-bold'
                                  }
                                >
                                  {m.quantity_change >= 0 ? `+${m.quantity_change}` : m.quantity_change}
                                </span>{' '}
                                → <span className="font-bold">{m.quantity_after}</span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-500">
                                {m.notes} ({m.actor_name || 'System'})
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {invSubTab === 'TRANSFER' && (
                <div className="max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Inter-Store & Warehouse Stock Transfer
                  </h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await fetch('/api/inventory/transfer', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-id': String(currentUserId),
                        },
                        body: JSON.stringify(transferForm),
                      });
                      const d = await res.json();
                      if (res.ok) {
                        await fetchBootstrap();
                        notify('success', `Stock transfer ${d.transferNumber} completed.`);
                      } else {
                        notify('error', d.error || 'Transfer failed');
                      }
                    }}
                    className="space-y-4 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-500 mb-1">From Source Store / Warehouse</label>
                        <select
                          value={transferForm.fromStoreId}
                          onChange={(e) => setTransferForm({ ...transferForm, fromStoreId: Number(e.target.value) })}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          {stores.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">To Destination Store / Warehouse</label>
                        <select
                          value={transferForm.toStoreId}
                          onChange={(e) => setTransferForm({ ...transferForm, toStoreId: Number(e.target.value) })}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          {stores.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-500 mb-1">Product to Transfer</label>
                      <select
                        value={transferForm.productId}
                        onChange={(e) => setTransferForm({ ...transferForm, productId: Number(e.target.value) })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      >
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-500 mb-1">Quantity to Transfer</label>
                      <input
                        type="number"
                        min={1}
                        value={transferForm.quantity}
                        onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 mb-1">Transfer Notes</label>
                      <input
                        type="text"
                        value={transferForm.notes}
                        onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      Execute Atomic Stock Transfer
                    </button>
                  </form>
                </div>
              )}

              {invSubTab === 'PO' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Create Supplier Purchase Order
                    </h3>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const res = await fetch('/api/purchase-orders', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'x-user-id': String(currentUserId),
                          },
                          body: JSON.stringify({
                            storeId: activeStore?.id || 1,
                            ...poForm,
                          }),
                        });
                        const d = await res.json();
                        if (res.ok) {
                          await fetchBootstrap();
                          notify('success', `Created Purchase Order ${d.poNumber}`);
                        }
                      }}
                      className="space-y-3 text-xs"
                    >
                      <div>
                        <label className="block text-slate-500 mb-1">Supplier</label>
                        <select
                          value={poForm.supplierId}
                          onChange={(e) => setPoForm({ ...poForm, supplierId: Number(e.target.value) })}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          {suppliers.map((sup: any) => (
                            <option key={sup.id} value={sup.id}>
                              {sup.name} ({sup.code})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Product</label>
                        <select
                          value={poForm.productId}
                          onChange={(e) => setPoForm({ ...poForm, productId: Number(e.target.value) })}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          {products.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} — {p.name} (Cost: ₱{p.cost_price})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-1">Order Quantity</label>
                        <input
                          type="number"
                          min={1}
                          value={poForm.quantity}
                          onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) })}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        Issue Purchase Order
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Purchase Orders & Receiving Records
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/60 dark:bg-slate-950/40">
                            <th className="py-3 px-4 font-medium">PO Number</th>
                            <th className="py-3 px-4 font-medium">Supplier & Store</th>
                            <th className="py-3 px-4 font-medium">Line Items</th>
                            <th className="py-3 px-4 font-medium text-right">Total Cost</th>
                            <th className="py-3 px-4 font-medium">Status</th>
                            <th className="py-3 px-4 font-medium text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                          {(data?.purchaseOrders || []).map((po: any) => (
                            <tr key={po.id}>
                              <td className="py-3 px-4 font-mono font-semibold">{po.po_number}</td>
                              <td className="py-3 px-4">
                                <div className="font-semibold">{po.supplier_name}</div>
                                <div className="text-slate-500">{po.store_name}</div>
                              </td>
                              <td className="py-3 px-4">
                                {(po.items || []).map((it: any, idx: number) => (
                                  <div key={idx}>
                                    {it.quantity}x {it.sku} ({it.name})
                                  </div>
                                ))}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold">
                                {formatMoney(po.total_amount, po.currency_code)}
                              </td>
                              <td className="py-3 px-4 font-mono">
                                <span
                                  className={
                                    po.status === 'RECEIVED'
                                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                      : 'text-amber-600 dark:text-amber-400 font-semibold'
                                  }
                                >
                                  {po.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {po.status !== 'RECEIVED' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
                                        method: 'POST',
                                        headers: { 'x-user-id': String(currentUserId) },
                                      });
                                      if (res.ok) {
                                        await fetchBootstrap();
                                        notify('success', `Received ${po.po_number} into inventory ledger.`);
                                      }
                                    }}
                                    className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                  >
                                    Receive Stock
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================================================================== */}
          {/* VIEW 4: CASH REGISTER DRAWER MANAGEMENT                               */}
          {/* ===================================================================== */}
          {activeTab === 'REGISTER' && (
            <div className="space-y-6">
              {data?.activeRegisterSession ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          Active Cash Register Drawer Session #{data.activeRegisterSession.id}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {data.activeRegisterSession.store_name} · Opened by {data.activeRegisterSession.opened_by_name}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        OPEN SHIFT
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs tabular-nums">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-slate-500">Opening Balance</p>
                        <p className="text-base font-bold font-mono mt-1">
                          {formatMoney(data.activeRegisterSession.opening_balance, data.activeRegisterSession.currency_code)}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-slate-500">Cash Sales</p>
                        <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                          +{formatMoney(data.activeRegisterSession.cash_sales_total, data.activeRegisterSession.currency_code)}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-slate-500">Cash Deposits</p>
                        <p className="text-base font-bold font-mono mt-1">
                          +{formatMoney(data.activeRegisterSession.cash_deposits_total, data.activeRegisterSession.currency_code)}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-slate-500">Cash Withdrawals</p>
                        <p className="text-base font-bold font-mono text-amber-600 mt-1">
                          -{formatMoney(data.activeRegisterSession.cash_withdrawals_total, data.activeRegisterSession.currency_code)}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <p className="text-slate-500">Cash Refunds</p>
                        <p className="text-base font-bold font-mono text-red-600 mt-1">
                          -{formatMoney(data.activeRegisterSession.cash_refunds_total, data.activeRegisterSession.currency_code)}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                        <p className="text-blue-700 dark:text-blue-300 font-medium">Expected Drawer Cash</p>
                        <p className="text-base font-bold font-mono text-blue-700 dark:text-blue-300 mt-1">
                          {formatMoney(data.activeRegisterSession.expected_closing_balance, data.activeRegisterSession.currency_code)}
                        </p>
                      </div>
                    </div>

                    {/* Cash Movement Form */}
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const res = await fetch('/api/register/movement', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'x-user-id': String(currentUserId),
                          },
                          body: JSON.stringify({
                            sessionId: data.activeRegisterSession.id,
                            type: regMoveType,
                            amount: regMoveAmount,
                            reason: regMoveReason,
                          }),
                        });
                        if (res.ok) {
                          await fetchBootstrap();
                          notify('success', `Recorded cash ${regMoveType.toLowerCase()} in drawer.`);
                        }
                      }}
                      className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
                    >
                      <select
                        value={regMoveType}
                        onChange={(e) => setRegMoveType(e.target.value as any)}
                        className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      >
                        <option value="DEPOSIT">Cash Deposit (+)</option>
                        <option value="WITHDRAWAL">Cash Drop / Withdrawal (-)</option>
                      </select>
                      <input
                        type="text"
                        value={regMoveAmount}
                        onChange={(e) => setRegMoveAmount(e.target.value)}
                        placeholder="Amount"
                        className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                      />
                      <input
                        type="text"
                        required
                        value={regMoveReason}
                        onChange={(e) => setRegMoveReason(e.target.value)}
                        placeholder="Reason for adjustment"
                        className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      />
                      <button
                        type="submit"
                        className="min-h-[42px] px-4 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-semibold"
                      >
                        Record Cash Adjustment
                      </button>
                    </form>
                  </div>

                  {/* Close Register & Variance Reconciliation */}
                  <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Close Register & Reconcile Cash Variance
                    </h3>
                    <p className="text-xs text-slate-500">
                      Count physical bills and coins in the drawer. The system records expected vs. actual closing balance and cashier accountability.
                    </p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const res = await fetch('/api/register/close', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'x-user-id': String(currentUserId),
                          },
                          body: JSON.stringify({
                            sessionId: data.activeRegisterSession.id,
                            actualClosingBalance: regActualClose || data.activeRegisterSession.expected_closing_balance,
                            notes: 'End-of-shift physical drawer count verified',
                          }),
                        });
                        const d = await res.json();
                        if (res.ok) {
                          await fetchBootstrap();
                          notify('success', `Register closed. Cash variance: ${d.variance}`);
                        }
                      }}
                      className="space-y-3 text-xs"
                    >
                      <div>
                        <label className="block text-slate-500 mb-1">
                          Actual Physical Cash Counted ({data.activeRegisterSession.currency_code})
                        </label>
                        <input
                          type="text"
                          placeholder={data.activeRegisterSession.expected_closing_balance}
                          value={regActualClose}
                          onChange={(e) => setRegActualClose(e.target.value)}
                          className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full min-h-[46px] rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
                      >
                        Close Shift Register Drawer
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Open New Cash Register Session
                  </h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await fetch('/api/register/open', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-id': String(currentUserId),
                        },
                        body: JSON.stringify({
                          storeId: activeStore?.id || 1,
                          terminalId: data?.terminals?.[0]?.id || 1,
                          openingBalance: regOpenFloat,
                          currencyCode: activeTenant?.primary_currency || 'PHP',
                          notes: 'Shift opening float',
                        }),
                      });
                      if (res.ok) {
                        await fetchBootstrap();
                        notify('success', 'Opened cash register session.');
                      }
                    }}
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="block text-slate-500 mb-1">Opening Cash Float</label>
                      <input
                        type="text"
                        value={regOpenFloat}
                        onChange={(e) => setRegOpenFloat(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      Open Cash Register Drawer
                    </button>
                  </form>
                </div>
              )}

              {/* Register Session History */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cash Register Shift History & Variance Audit
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/60 dark:bg-slate-950/40">
                        <th className="py-3 px-4 font-medium">Shift ID</th>
                        <th className="py-3 px-4 font-medium">Store & Terminal</th>
                        <th className="py-3 px-4 font-medium">Cashier</th>
                        <th className="py-3 px-4 font-medium text-right">Opening</th>
                        <th className="py-3 px-4 font-medium text-right">Expected Close</th>
                        <th className="py-3 px-4 font-medium text-right">Actual Close</th>
                        <th className="py-3 px-4 font-medium text-right">Variance</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                      {(data?.registerSessions || []).map((rs: any) => (
                        <tr key={rs.id}>
                          <td className="py-3 px-4 font-mono font-semibold">#{rs.id}</td>
                          <td className="py-3 px-4">
                            {rs.store_name} ({rs.terminal_code})
                          </td>
                          <td className="py-3 px-4">{rs.opened_by_name}</td>
                          <td className="py-3 px-4 text-right font-mono">
                            {formatMoney(rs.opening_balance, rs.currency_code)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            {formatMoney(rs.expected_closing_balance, rs.currency_code)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {rs.actual_closing_balance
                              ? formatMoney(rs.actual_closing_balance, rs.currency_code)
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            {rs.variance_amount ? formatMoney(rs.variance_amount, rs.currency_code) : '0.00'}
                          </td>
                          <td className="py-3 px-4 font-mono">{rs.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* VIEW 5: MULTI-CURRENCY REPORTS & ANALYTICS DASHBOARD                  */}
          {/* ===================================================================== */}
          {activeTab === 'DASHBOARD' && (
            <div id="printable-report-area" className="space-y-6">
              {/* Top Filter & Export Bar */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Owner Analytics & Segregated Multi-Currency Financial Reports
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    PHP (₱) and USD ($) revenues are strictly separated using exact DECIMAL arithmetic. Profit is calculated as Net Sales (ex-Tax) minus Cost of Goods Sold (COGS).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={reportCurrencyFilter}
                    onChange={(e) => setReportCurrencyFilter(e.target.value as any)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                  >
                    <option value="SEPARATED">Segregated PHP (₱) & USD ($) Totals</option>
                    <option value="PHP_ONLY">PHP (₱) Transactions Only</option>
                    <option value="USD_ONLY">USD ($) Transactions Only</option>
                    <option value="CONVERTED_SNAPSHOT">Explicit Snapshot Conversion in PHP</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleExportSalesCsv}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print / PDF Report</span>
                  </button>
                </div>
              </div>

              {/* Segregated PHP & USD Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PHP Ledger Card */}
                {(reportCurrencyFilter === 'SEPARATED' ||
                  reportCurrencyFilter === 'PHP_ONLY' ||
                  reportCurrencyFilter === 'CONVERTED_SNAPSHOT') && (
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        Philippine Peso Ledger (PHP ₱)
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {financialAnalytics.phpCount} Completed Sale(s)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs tabular-nums">
                      <div>
                        <p className="text-slate-500">Gross Sales (PHP)</p>
                        <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                          {formatMoney(financialAnalytics.phpGross, 'PHP')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">COGS Cost Basis</p>
                        <p className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                          {formatMoney(financialAnalytics.phpCogs, 'PHP')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">True Net Profit (PHP)</p>
                        <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {formatMoney(financialAnalytics.phpProfit, 'PHP')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Discounts Given</p>
                        <p className="font-mono font-semibold mt-0.5">
                          {formatMoney(financialAnalytics.phpDiscount, 'PHP')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Collected VAT / Tax</p>
                        <p className="font-mono font-semibold mt-0.5">
                          {formatMoney(financialAnalytics.phpTax, 'PHP')}
                        </p>
                      </div>
                      {reportCurrencyFilter === 'CONVERTED_SNAPSHOT' && (
                        <div>
                          <p className="text-blue-600 dark:text-blue-400 font-medium">
                            Combined w/ Historical USD Rate Snapshots
                          </p>
                          <p className="font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                            {formatMoney(financialAnalytics.convertedPhpSnapshotTotal, 'PHP')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* USD Ledger Card */}
                {(reportCurrencyFilter === 'SEPARATED' || reportCurrencyFilter === 'USD_ONLY') && (
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        US Dollar Ledger (USD $)
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {financialAnalytics.usdCount} Completed Sale(s)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs tabular-nums">
                      <div>
                        <p className="text-slate-500">Gross Sales (USD)</p>
                        <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                          {formatMoney(financialAnalytics.usdGross, 'USD')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">COGS Cost Basis</p>
                        <p className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                          {formatMoney(financialAnalytics.usdCogs, 'USD')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">True Net Profit (USD)</p>
                        <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {formatMoney(financialAnalytics.usdProfit, 'USD')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Discounts Given</p>
                        <p className="font-mono font-semibold mt-0.5">
                          {formatMoney(financialAnalytics.usdDiscount, 'USD')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Collected Tax</p>
                        <p className="font-mono font-semibold mt-0.5">
                          {formatMoney(financialAnalytics.usdTax, 'USD')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Report Breakdown Selector */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'OVERVIEW', label: 'All Transactions & Profit Ledger' },
                  { id: 'BY_STORE', label: 'Sales by Store' },
                  { id: 'BY_CASHIER', label: 'Sales by Cashier' },
                  { id: 'BY_PRODUCT', label: 'Best-Selling Products' },
                  { id: 'TAX_REFUNDS', label: 'Tax & Refund Reports' },
                ].map((rt) => (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => setReportType(rt.id as any)}
                    className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      reportType === rt.id
                        ? 'bg-slate-900 dark:bg-blue-600 text-white font-semibold'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {rt.label}
                  </button>
                ))}
              </div>

              {/* Detailed Transactions & COGS Profit Table */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/60 dark:bg-slate-950/40">
                        <th className="py-3 px-4 font-medium">OR / Txn No.</th>
                        <th className="py-3 px-4 font-medium">Store & Cashier</th>
                        <th className="py-3 px-4 font-medium">Currency & Snapshot</th>
                        <th className="py-3 px-4 font-medium text-right">Subtotal</th>
                        <th className="py-3 px-4 font-medium text-right">Discount / Tax</th>
                        <th className="py-3 px-4 font-medium text-right">Grand Total</th>
                        <th className="py-3 px-4 font-medium text-right">COGS</th>
                        <th className="py-3 px-4 font-medium text-right">Net Profit</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                      {sales
                        .filter((s: any) =>
                          reportCurrencyFilter === 'PHP_ONLY'
                            ? s.currency_code === 'PHP'
                            : reportCurrencyFilter === 'USD_ONLY'
                            ? s.currency_code === 'USD'
                            : true
                        )
                        .map((s: any) => (
                          <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-mono font-semibold">{s.transaction_number}</td>
                            <td className="py-3 px-4">
                              <div>{s.store_name}</div>
                              <div className="text-slate-500">{s.cashier_name}</div>
                            </td>
                            <td className="py-3 px-4 font-mono">
                              {s.currency_code} (Rate: {s.exchange_rate_snapshot})
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {formatMoney(s.subtotal, s.currency_code)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              -{formatMoney(s.discount_total, s.currency_code)} / +{formatMoney(s.tax_total, s.currency_code)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold">
                              {formatMoney(s.grand_total, s.currency_code)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-500">
                              {formatMoney(s.cogs_total, s.currency_code)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatMoney(s.profit_total, s.currency_code)}
                            </td>
                            <td className="py-3 px-4 font-mono">{s.status}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* VIEW 6: CUSTOMERS & SUPPLIERS CRM                                     */}
          {/* ===================================================================== */}
          {activeTab === 'CUSTOMERS' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customers Directory */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Customer Profiles, Loyalty Points & VIP Discounts
                </h3>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch('/api/customers', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': String(currentUserId),
                      },
                      body: JSON.stringify(newCustomer),
                    });
                    if (res.ok) {
                      setNewCustomer({ name: '', email: '', phone: '', discountRate: '5.00' });
                      await fetchBootstrap();
                      notify('success', 'Customer profile created.');
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs"
                >
                  <input
                    type="text"
                    required
                    placeholder="Customer Full Name *"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Mobile Phone *"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Discount % (e.g. 5.00)"
                      value={newCustomer.discountRate}
                      onChange={(e) => setNewCustomer({ ...newCustomer, discountRate: e.target.value })}
                      className="w-24 min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                    />
                    <button
                      type="submit"
                      className="flex-1 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      Add Customer
                    </button>
                  </div>
                </form>

                <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs tabular-nums">
                  {customers.map((c: any) => (
                    <div key={c.id} className="py-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {c.name} ({c.code})
                        </div>
                        <div className="text-slate-500">
                          {c.phone} · {c.email || 'No email'} · Discount: {c.discount_rate}%
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-bold text-blue-600 dark:text-blue-400">{c.loyalty_points} pts</div>
                        <div className="text-slate-500">
                          Spent: {formatMoney(c.total_spent_php, 'PHP')} / {formatMoney(c.total_spent_usd, 'USD')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suppliers Directory */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Suppliers & Payable Ledger
                </h3>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch('/api/suppliers', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': String(currentUserId),
                      },
                      body: JSON.stringify(newSupplier),
                    });
                    if (res.ok) {
                      setNewSupplier({ name: '', contactPerson: '', email: '', phone: '', address: '' });
                      await fetchBootstrap();
                      notify('success', 'Supplier added.');
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs"
                >
                  <input
                    type="text"
                    required
                    placeholder="Supplier Company Name *"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Contact Person *"
                    value={newSupplier.contactPerson}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    Add Supplier
                  </button>
                </form>

                <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs tabular-nums">
                  {suppliers.map((sup: any) => (
                    <div key={sup.id} className="py-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {sup.name} ({sup.code})
                        </div>
                        <div className="text-slate-500">
                          Contact: {sup.contact_person} · {sup.phone}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-slate-500">Payable Balance</div>
                        <div className="font-semibold">{formatMoney(sup.balance_php, 'PHP')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* VIEW 7: SAAS SUBSCRIPTION & BILLING                                   */}
          {/* ===================================================================== */}
          {activeTab === 'SUBSCRIPTION' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    SaaS Subscription & Billing Management
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Current Plan: <strong>{activeTenant?.plan_code}</strong> ({activeTenant?.billing_cycle}) · Status:{' '}
                    <strong className="text-emerald-600">{activeTenant?.subscription_status}</strong> · Renews:{' '}
                    {activeTenant?.current_period_ends_at ? new Date(activeTenant.current_period_ends_at).toLocaleDateString() : 'Active'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(data?.subscriptionPlans || []).map((plan: any) => {
                  const isCurrent = activeTenant?.plan_code === plan.code;
                  return (
                    <div
                      key={plan.code}
                      className={`p-6 rounded-2xl border flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-white dark:bg-slate-900 border-blue-600 ring-1 ring-blue-600/20'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                          {isCurrent && (
                            <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                              ACTIVE PLAN
                            </span>
                          )}
                        </div>
                        <div className="text-2xl font-bold font-mono tabular-nums">
                          {formatMoney(plan.monthly_price_usd, 'USD')} <span className="text-xs font-normal text-slate-500">/ mo</span>
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                          or {formatMoney(plan.monthly_price_php, 'PHP')} / mo
                        </div>
                        <ul className="space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
                          {(plan.features || []).map((f: string, idx: number) => (
                            <li key={idx}>· {f}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-5 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch('/api/subscriptions/change', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': String(currentUserId),
                              },
                              body: JSON.stringify({
                                planCode: plan.code,
                                billingCycle: 'MONTHLY',
                                currencyCode: 'USD',
                              }),
                            });
                            if (res.ok) {
                              await fetchBootstrap();
                              notify('success', `Switched subscription to ${plan.name} (Monthly USD).`);
                            }
                          }}
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                        >
                          Select Monthly
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch('/api/subscriptions/change', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': String(currentUserId),
                              },
                              body: JSON.stringify({
                                planCode: plan.code,
                                billingCycle: 'ANNUAL',
                                currencyCode: 'PHP',
                              }),
                            });
                            if (res.ok) {
                              await fetchBootstrap();
                              notify('success', `Switched subscription to ${plan.name} (Annual PHP).`);
                            }
                          }}
                          className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold"
                        >
                          Select Annual (₱)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Subscription Invoices Table */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    SaaS Billing Invoices (Separated from Store Retail Sales)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/60 dark:bg-slate-950/40">
                        <th className="py-3 px-4 font-medium">Invoice No.</th>
                        <th className="py-3 px-4 font-medium">Plan & Cycle</th>
                        <th className="py-3 px-4 font-medium text-right">Amount</th>
                        <th className="py-3 px-4 font-medium">Webhook Provider Ref</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium">Paid At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                      {(data?.subscriptionInvoices || []).map((inv: any) => (
                        <tr key={inv.id}>
                          <td className="py-3 px-4 font-mono font-semibold">{inv.invoice_number}</td>
                          <td className="py-3 px-4">
                            {inv.plan_code} ({inv.billing_cycle})
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            {formatMoney(inv.amount, inv.currency_code)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">{inv.provider_ref}</td>
                          <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {inv.status}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {new Date(inv.paid_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* VIEW 8: BUSINESS, MULTI-STORE & EMPLOYEE RBAC SETTINGS                */}
          {/* ===================================================================== */}
          {activeTab === 'SETTINGS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Tenant Financial, Tax & Receipt Branding Settings */}
              <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Business Profile, Multi-Currency & Receipt Branding
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch('/api/settings/tenant', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': String(currentUserId),
                      },
                      body: JSON.stringify(settingsForm),
                    });
                    if (res.ok) {
                      await fetchBootstrap();
                      notify('success', 'Saved business settings & currency exchange rate.');
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1">Business Legal Name</label>
                      <input
                        type="text"
                        value={settingsForm.name}
                        onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Tax ID / VAT Reg TIN</label>
                      <input
                        type="text"
                        value={settingsForm.taxIdTin}
                        onChange={(e) => setSettingsForm({ ...settingsForm, taxIdTin: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Primary Currency</label>
                      <select
                        value={settingsForm.primaryCurrency}
                        onChange={(e) => setSettingsForm({ ...settingsForm, primaryCurrency: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      >
                        <option value="PHP">PHP — Philippine Peso (₱)</option>
                        <option value="USD">USD — US Dollar ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">1 USD to PHP Exchange Rate</label>
                      <input
                        type="text"
                        value={settingsForm.usdToPhpRate}
                        onChange={(e) => setSettingsForm({ ...settingsForm, usdToPhpRate: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Default Tax / VAT Rate (%)</label>
                      <input
                        type="text"
                        value={settingsForm.defaultTaxRate}
                        onChange={(e) => setSettingsForm({ ...settingsForm, defaultTaxRate: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Default Service Charge (%)</label>
                      <input
                        type="text"
                        value={settingsForm.defaultServiceChargeRate}
                        onChange={(e) => setSettingsForm({ ...settingsForm, defaultServiceChargeRate: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.allowNegativeStock}
                      onChange={(e) => setSettingsForm({ ...settingsForm, allowNegativeStock: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span>Allow Negative Stock on Online POS Sales (Disabled by default for strict stock control)</span>
                  </label>

                  <div>
                    <label className="block text-slate-500 mb-1">Custom Thermal Receipt Header</label>
                    <input
                      type="text"
                      value={settingsForm.receiptHeader}
                      onChange={(e) => setSettingsForm({ ...settingsForm, receiptHeader: e.target.value })}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1">Custom Thermal Receipt Footer</label>
                    <input
                      type="text"
                      value={settingsForm.receiptFooter}
                      onChange={(e) => setSettingsForm({ ...settingsForm, receiptFooter: e.target.value })}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    Save Business & Financial Settings
                  </button>
                </form>
              </div>

              {/* Stores & Employees RBAC Management */}
              <div className="lg:col-span-6 space-y-6">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Add Store Branch or Warehouse
                  </h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await fetch('/api/stores', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-id': String(currentUserId),
                        },
                        body: JSON.stringify(newStoreForm),
                      });
                      if (res.ok) {
                        setNewStoreForm({ code: '', name: '', address: '', phone: '', isWarehouse: false });
                        await fetchBootstrap();
                        notify('success', 'Store location created.');
                      }
                    }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Store Code (e.g. CEB-03) *"
                      value={newStoreForm.code}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, code: e.target.value })}
                      className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Branch Name *"
                      value={newStoreForm.name}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, name: e.target.value })}
                      className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      placeholder="Address"
                      value={newStoreForm.address}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, address: e.target.value })}
                      className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                    <button
                      type="submit"
                      className="min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      Add Store Location
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Employee Accounts & Role-Based Access Control (RBAC)
                  </h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await fetch('/api/users', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-user-id': String(currentUserId),
                        },
                        body: JSON.stringify({
                          ...newStaffForm,
                          assignedStoreId: activeStore?.id || 1,
                        }),
                      });
                      if (res.ok) {
                        setNewStaffForm({ name: '', email: '', roleCode: 'CASHIER', pinCode: '5555' });
                        await fetchBootstrap();
                        notify('success', 'Created employee account.');
                      }
                    }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Employee Name *"
                      value={newStaffForm.name}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                      className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Employee Email *"
                      value={newStaffForm.email}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                      className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                    <select
                      value={newStaffForm.roleCode}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, roleCode: e.target.value })}
                      className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    >
                      <option value="CASHIER">CASHIER (POS Terminal & Register)</option>
                      <option value="STORE_MANAGER">STORE_MANAGER (Store Inventory & Reports)</option>
                      <option value="BUSINESS_OWNER">BUSINESS_OWNER (Full Tenant Scope)</option>
                    </select>
                    <button
                      type="submit"
                      className="min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      Create Staff Account
                    </button>
                  </form>

                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {(data?.tenantUsers || []).map((tu: any) => (
                      <div key={tu.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">{tu.name}</span>
                          <span className="text-slate-500 ml-2">{tu.email}</span>
                        </div>
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                          {tu.role_code}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* VIEWS 9–12: SUPERADMIN, 9-STEP INSTALLER, BACKUPS & AUTOMATED QA      */}
          {/* ===================================================================== */}
          {(activeTab === 'SUPERADMIN' ||
            activeTab === 'INSTALLER' ||
            activeTab === 'BACKUPS' ||
            activeTab === 'TESTS') && (
            <PlatformOpsCenter
              activeSubTab={activeTab}
              currentUser={currentUser}
              allTenants={data?.allTenants || []}
              subscriptionPlans={data?.subscriptionPlans || []}
              auditLogs={data?.auditLogs || []}
              backups={data?.backups || []}
              installationState={data?.installationState}
              onRefresh={fetchBootstrap}
              onSwitchTenantView={(tid) => {
                setCurrentUserId(1); // Switch to Superadmin inspecting target tenant
                setOverrideTenantId(tid);
                setActiveTab('POS');
                notify('success', `Switched Superadmin inspection context to Tenant #${tid}`);
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Thumb-Zone Navigation, <= 15% Viewport Height) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center h-14 px-2">
        {[
          { id: 'POS', label: 'POS', icon: ShoppingCart },
          { id: 'OFFLINE_SYNC', label: `Sync (${pendingOfflineCount})`, icon: WifiOff },
          { id: 'INVENTORY', label: 'Stock', icon: Package },
          { id: 'DASHBOARD', label: 'Reports', icon: BarChart3 },
          { id: 'TESTS', label: 'QA & ZIP', icon: ShieldCheck },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as WorkspaceTab)}
              className={`min-h-[44px] flex flex-col items-center justify-center ${
                active ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] mt-0.5 truncate">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Product Variant Selector Modal */}
      {variantPickerProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Select Variant — {variantPickerProduct.name}
            </h3>
            <div className="space-y-2">
              {(variantPickerProduct.variants || []).map((v: any, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    addToCart(variantPickerProduct, v.name, v.priceDelta || '0.00');
                    setVariantPickerProduct(null);
                  }}
                  className="w-full min-h-[46px] p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-600 flex items-center justify-between text-xs font-medium"
                >
                  <span>{v.name}</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {toCents(v.priceDelta) > 0 ? `+₱${v.priceDelta}` : 'Standard Price'}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setVariantPickerProduct(null)}
              className="w-full min-h-[42px] rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create New Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Add New Catalog Product & Opening Stock
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/products', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': String(currentUserId),
                  },
                  body: JSON.stringify({
                    ...prodForm,
                    storeId: activeStore?.id || 1,
                  }),
                });
                const d = await res.json();
                if (res.ok) {
                  setShowProductModal(false);
                  await fetchBootstrap();
                  notify('success', `Product ${prodForm.name} created.`);
                } else {
                  notify('error', d.error || 'Failed to create product');
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
            >
              <div>
                <label className="block text-slate-500 mb-1">SKU Code *</label>
                <input
                  type="text"
                  required
                  placeholder="AUR-DRP-01"
                  value={prodForm.sku}
                  onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">EAN-13 / Barcode *</label>
                <input
                  type="text"
                  required
                  placeholder="4800192837999"
                  value={prodForm.barcode}
                  onChange={(e) => setProdForm({ ...prodForm, barcode: e.target.value })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-500 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Single-Origin Pour Over Dripper"
                  value={prodForm.name}
                  onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Cost Price (PHP ₱)</label>
                <input
                  type="text"
                  value={prodForm.costPrice}
                  onChange={(e) => setProdForm({ ...prodForm, costPrice: e.target.value })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Selling Price (PHP ₱)</label>
                <input
                  type="text"
                  value={prodForm.sellingPrice}
                  onChange={(e) => setProdForm({ ...prodForm, sellingPrice: e.target.value })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Opening Store Stock</label>
                <input
                  type="number"
                  value={prodForm.initialStock}
                  onChange={(e) => setProdForm({ ...prodForm, initialStock: Number(e.target.value) })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={prodForm.expirationDate}
                  onChange={(e) => setProdForm({ ...prodForm, expirationDate: e.target.value })}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 rounded-xl bg-blue-600 text-white font-semibold"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Receipt & Local Print Bridge Modal */}
      {activeReceiptSale && (
        <ReceiptModal
          sale={activeReceiptSale}
          tenant={activeTenant}
          store={activeStore}
          onClose={() => setActiveReceiptSale(null)}
        />
      )}

      {/* Camera & USB Barcode Scanner Modal */}
      {showScannerModal && (
        <BarcodeScannerModal
          products={products}
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScannerModal(false)}
        />
      )}
    </div>
  );
}
