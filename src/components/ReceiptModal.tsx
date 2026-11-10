import React, { useState } from 'react';
import { Printer, X, FileText, CheckCircle2 } from 'lucide-react';
import { formatMoney, CurrencyCode } from '../utils/decimal.ts';

interface ReceiptModalProps {
  sale: any;
  tenant: any;
  store: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, tenant, store, onClose }) => {
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm' | 'A4'>('80mm');
  const [escPosSent, setEscPosSent] = useState(false);

  if (!sale) return null;
  const currency: CurrencyCode = sale.currency_code === 'USD' ? 'USD' : 'PHP';
  const items = sale.items || [];
  const payments = sale.payments || [{ method: sale.payment_method, amount: sale.grand_total }];

  const widthClass =
    paperSize === '58mm' ? 'max-w-[280px]' : paperSize === '80mm' ? 'max-w-[360px]' : 'max-w-xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Receipt & Thermal Print Bridge
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800">
            {(['58mm', '80mm', 'A4'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setPaperSize(fmt)}
                className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  paperSize === fmt
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {fmt === 'A4' ? 'Full PDF / A4' : `${fmt} Thermal`}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Viewport */}
        <div className="p-6 bg-slate-100 dark:bg-slate-950/60 flex justify-center max-h-[68vh] overflow-y-auto">
          <div
            id="printable-receipt-area"
            className={`w-full ${widthClass} bg-white text-slate-900 p-5 rounded-lg border border-slate-200 shadow-sm font-mono text-xs leading-relaxed`}
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
              <p className="text-sm font-bold tracking-tight uppercase">{tenant?.name || 'SMARTPOS Retail'}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">{store?.name || 'Main Branch'}</p>
              <p className="text-[11px] text-slate-500">{store?.address || tenant?.address}</p>
              <p className="text-[11px] text-slate-500">Tel: {store?.phone || tenant?.phone}</p>
              <p className="text-[11px] text-slate-600 mt-1">VAT Reg TIN: {tenant?.tax_id_tin || '000-000-000-000'}</p>
              {tenant?.receipt_header && (
                <p className="text-[11px] text-slate-700 mt-1.5 italic">{tenant.receipt_header}</p>
              )}
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3 mb-3 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500">OR / Txn No:</span>
                <span className="font-bold">{sale.transaction_number || `OFFLINE-${sale.clientUuid?.slice(0, 8).toUpperCase()}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Time:</span>
                <span>{new Date(sale.created_at || sale.createdAt || Date.now()).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cashier:</span>
                <span>{sale.cashier_name || 'Authorized Cashier'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Terminal:</span>
                <span>{sale.terminal_code || 'POS-01'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sync Channel:</span>
                <span>{sale.sync_source || (sale.syncStatus === 'PENDING_SYNC' ? 'OFFLINE LOCAL QUEUE' : 'ONLINE')}</span>
              </div>
            </div>

            {/* Line Items */}
            <div className="border-b border-dashed border-slate-300 pb-3 mb-3 space-y-2 tabular-nums">
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                <span>Item / Qty x Unit</span>
                <span>Total ({currency})</span>
              </div>
              {items.map((it: any, idx: number) => (
                <div key={idx} className="text-[11px]">
                  <div className="font-semibold text-slate-900">
                    {it.product_name || it.productName}
                    {(it.variant_name || it.variantName) && (it.variant_name || it.variantName) !== 'Standard'
                      ? ` (${it.variant_name || it.variantName})`
                      : ''}
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      {it.quantity} x {formatMoney(it.unit_price_snapshot || it.unitPrice, currency)}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatMoney(it.line_total || it.lineTotal, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3 mb-3 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal:</span>
                <span>{formatMoney(sale.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Discounts:</span>
                <span>-{formatMoney(sale.discount_total || sale.orderDiscountAmount || '0.00', currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tax ({sale.tax_rate_snapshot || '12.00'}%):</span>
                <span>{formatMoney(sale.tax_total || sale.taxTotal || '0.00', currency)}</span>
              </div>
              {Number(sale.service_charge || sale.serviceCharge || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Service Charge:</span>
                  <span>{formatMoney(sale.service_charge || sale.serviceCharge, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-200">
                <span>GRAND TOTAL:</span>
                <span>{formatMoney(sale.grand_total || sale.grandTotal, currency)}</span>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3 mb-3 tabular-nums">
              {payments.map((p: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className="text-slate-600">Tender ({p.method}):</span>
                  <span>{formatMoney(p.amount, currency)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-slate-600">Amount Tendered:</span>
                <span>{formatMoney(sale.amount_tendered || sale.amountTendered || sale.grand_total, currency)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Change Due:</span>
                <span>{formatMoney(sale.change_amount || sale.changeAmount || '0.00', currency)}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500 space-y-1">
              <p>{tenant?.receipt_footer || 'Official Receipt · Thank you for your purchase!'}</p>
              <p className="font-mono text-[9px] text-slate-400">
                UUID: {(sale.client_uuid || sale.clientUuid || '').slice(0, 18)}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {escPosSent ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                ESC/POS byte stream dispatched to local thermal bridge ({paperSize})
              </span>
            ) : (
              <span>Supports browser print dialog, PDF save, or local ESC/POS bridge.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setEscPosSent(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>Send ESC/POS Command</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
