/**
 * SMARTPOS IndexedDB Offline Storage Engine
 * Provides persistent browser storage for:
 * 1. Offline Product Catalog Cache
 * 2. Offline POS Sales Queue (with UUIDv4 idempotency keys)
 * 3. Held / Parked Orders (Hold & Resume)
 */

const DB_NAME = 'smartpos_offline_pwa_db';
const DB_VERSION = 1;

export interface OfflineQueuedSale {
  clientUuid: string;
  tenantId: number;
  storeId: number;
  terminalId: number;
  customerId: number | null;
  customerName?: string;
  currencyCode: 'PHP' | 'USD';
  exchangeRateSnapshot: string;
  subtotal: string;
  orderDiscountAmount: string;
  taxTotal: string;
  serviceCharge: string;
  grandTotal: string;
  applyTax: boolean;
  applyServiceCharge: boolean;
  paymentMethod: 'CASH' | 'CARD' | 'WALLET' | 'BANK_TRANSFER' | 'SPLIT';
  amountTendered: string;
  changeAmount: string;
  payments: Array<{ method: string; amount: string; reference?: string }>;
  items: Array<{
    productId: number;
    sku: string;
    productName: string;
    variantName: string;
    quantity: number;
    unitPrice: string;
    unitCost: string;
    lineTotal: string;
  }>;
  syncStatus: 'PENDING_SYNC' | 'SYNCHRONIZED' | 'CONFLICT_FLAGGED' | 'FAILED';
  serverTransactionNumber?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  syncedAt?: string;
}

export interface HeldOrderRecord {
  holdId: string;
  tenantId: number;
  storeId: number;
  customerName: string;
  customerId: number | null;
  currencyCode: 'PHP' | 'USD';
  note: string;
  items: Array<{
    productId: number;
    sku: string;
    name: string;
    variantName: string;
    quantity: number;
    unitPricePhp: string;
    unitPriceUsd: string;
    unitCostPhp: string;
    unitCostUsd: string;
  }>;
  heldAt: string;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('catalog_cache')) {
        db.createObjectStore('catalog_cache', { keyPath: 'cacheKey' });
      }
      if (!db.objectStoreNames.contains('offline_sales_queue')) {
        db.createObjectStore('offline_sales_queue', { keyPath: 'clientUuid' });
      }
      if (!db.objectStoreNames.contains('held_orders')) {
        db.createObjectStore('held_orders', { keyPath: 'holdId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineCatalogCache(tenantId: number, storeId: number, products: any[]): Promise<void> {
  try {
    const db = await openOfflineDb();
    const tx = db.transaction('catalog_cache', 'readwrite');
    tx.objectStore('catalog_cache').put({
      cacheKey: `tenant_${tenantId}_store_${storeId}`,
      tenantId,
      storeId,
      products,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Fallback silently if IndexedDB is restricted
  }
}

export async function getOfflineCatalogCache(tenantId: number, storeId: number): Promise<any[] | null> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve) => {
      const tx = db.transaction('catalog_cache', 'readonly');
      const req = tx.objectStore('catalog_cache').get(`tenant_${tenantId}_store_${storeId}`);
      req.onsuccess = () => resolve(req.result?.products || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function enqueueOfflineSale(sale: OfflineQueuedSale): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales_queue', 'readwrite');
    tx.objectStore('offline_sales_queue').put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineSalesQueue(tenantId?: number): Promise<OfflineQueuedSale[]> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve) => {
      const tx = db.transaction('offline_sales_queue', 'readonly');
      const req = tx.objectStore('offline_sales_queue').getAll();
      req.onsuccess = () => {
        const all = (req.result || []) as OfflineQueuedSale[];
        const filtered = tenantId ? all.filter((s) => s.tenantId === tenantId) : all;
        filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        resolve(filtered);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function updateOfflineSaleStatus(
  clientUuid: string,
  updates: Partial<OfflineQueuedSale>
): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve) => {
    const tx = db.transaction('offline_sales_queue', 'readwrite');
    const store = tx.objectStore('offline_sales_queue');
    const getReq = store.get(clientUuid);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, ...updates });
      }
      resolve();
    };
    getReq.onerror = () => resolve();
  });
}

export async function saveHeldOrder(order: HeldOrderRecord): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve) => {
    const tx = db.transaction('held_orders', 'readwrite');
    tx.objectStore('held_orders').put(order);
    tx.oncomplete = () => resolve();
  });
}

export async function getHeldOrders(tenantId: number): Promise<HeldOrderRecord[]> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve) => {
      const tx = db.transaction('held_orders', 'readonly');
      const req = tx.objectStore('held_orders').getAll();
      req.onsuccess = () => {
        const list = ((req.result || []) as HeldOrderRecord[]).filter((o) => o.tenantId === tenantId);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deleteHeldOrder(holdId: string): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve) => {
    const tx = db.transaction('held_orders', 'readwrite');
    tx.objectStore('held_orders').delete(holdId);
    tx.oncomplete = () => resolve();
  });
}
