'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Download,
  Plus,
  Printer,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CurrencyCode,
  Patient,
  PharmacyItem,
  PharmacySale,
  Prescription,
} from '@/lib/types';
import {
  daysUntilDate,
  downloadFile,
  formatCurrency,
  getTodayIsoDate,
  toCsv,
} from '@/lib/utils';

interface PharmacyViewProps {
  items: PharmacyItem[];
  sales: PharmacySale[];
  patients: Patient[];
  prescriptions: Prescription[];
  currency: CurrencyCode;
  hideFinancials: boolean;
  onSaveItem: (
    item: Omit<
      PharmacyItem,
      'id' | 'organizationId' | 'ownerUid' | 'authorizedUids' | 'createdByUid' | 'createdAt' | 'updatedAt'
    >
  ) => void;
  onCompleteSale: (sale: Omit<PharmacySale, 'id' | 'receiptNumber' | 'createdAt'>) => void;
}

export function PharmacyView({
  items,
  sales,
  patients,
  prescriptions,
  currency,
  hideFinancials,
  onSaveItem,
  onCompleteSale,
}: PharmacyViewProps) {
  const [tab, setTab] = useState<'inventory' | 'pos' | 'history'>('inventory');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [customerType, setCustomerType] = useState<'registered' | 'walk_in'>('registered');
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [walkInName, setWalkInName] = useState('');
  const [selectedRxId, setSelectedRxId] = useState('');
  const [cart, setCart] = useState<{ itemId: string; qty: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PharmacySale['paymentMethod']>('Cash');
  const [lastReceipt, setLastReceipt] = useState<PharmacySale | null>(null);

  const [form, setForm] = useState({
    brandName: '',
    genericName: '',
    manufacturer: '',
    batchNumber: '',
    barcode: '',
    purchasePrice: 0.2,
    sellingPrice: 0.4,
    stockQty: 100,
    reorderLevel: 30,
    expiryDate: getTodayIsoDate(),
  });

  const inventoryCostValue = items.reduce((s, i) => s + i.purchasePrice * i.stockQty, 0);
  const inventoryRetailValue = items.reduce((s, i) => s + i.sellingPrice * i.stockQty, 0);
  const expectedProfit = inventoryRetailValue - inventoryCostValue;
  const expiring90d = items.filter((i) => {
    const d = daysUntilDate(i.expiryDate);
    return d >= 0 && d <= 90;
  }).length;
  const lowStockCount = items.filter((i) => i.stockQty <= i.reorderLevel).length;

  const handleExportCsv = () => {
    const csv = toCsv(
      ['Brand', 'Generic', 'Batch', 'Barcode', 'Stock', 'Reorder', 'Purchase', 'Selling', 'Expiry'],
      items.map((i) => [
        i.brandName,
        i.genericName,
        i.batchNumber,
        i.barcode,
        i.stockQty,
        i.reorderLevel,
        i.purchasePrice,
        i.sellingPrice,
        i.expiryDate,
      ])
    );
    downloadFile(csv, `pravaclin-pharmacy-inventory-${getTodayIsoDate()}.csv`, 'text/csv;charset=utf-8;');
  };

  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveItem({
      brandName: form.brandName.trim(),
      genericName: form.genericName.trim(),
      manufacturer: form.manufacturer.trim() || undefined,
      batchNumber: form.batchNumber.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      purchasePrice: Number(form.purchasePrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      stockQty: Math.max(0, Number(form.stockQty) || 0),
      reorderLevel: Math.max(0, Number(form.reorderLevel) || 0),
      expiryDate: form.expiryDate,
      status: 'active',
    });
    setAddModalOpen(false);
    setForm({
      brandName: '',
      genericName: '',
      manufacturer: '',
      batchNumber: '',
      barcode: '',
      purchasePrice: 0.2,
      sellingPrice: 0.4,
      stockQty: 100,
      reorderLevel: 30,
      expiryDate: getTodayIsoDate(),
    });
  };

  const addToCart = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || item.stockQty <= 0) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === itemId);
      if (existing) {
        return prev.map((c) =>
          c.itemId === itemId ? { ...c, qty: Math.min(item.stockQty, c.qty + 10) } : c
        );
      }
      return [...prev, { itemId, qty: Math.min(item.stockQty, 10) }];
    });
  };

  const handleAutoMatchPrescription = (rxId: string) => {
    setSelectedRxId(rxId);
    const rx = prescriptions.find((r) => r.id === rxId);
    if (!rx) return;
    setCustomerType('registered');
    setSelectedPatientId(rx.patientId);
    const matched: { itemId: string; qty: number }[] = [];
    for (const med of rx.medicines) {
      const target = med.name.toLowerCase();
      const found = items.find(
        (i) =>
          i.stockQty > 0 &&
          (i.brandName.toLowerCase().includes(target.split(' ')[0]) ||
            target.includes(i.brandName.toLowerCase().split(' ')[0]))
      );
      if (found && !matched.some((m) => m.itemId === found.id)) {
        matched.push({ itemId: found.id, qty: Math.min(found.stockQty, 15) });
      }
    }
    setCart(matched);
  };

  const cartDetails = cart
    .map((entry) => {
      const item = items.find((i) => i.id === entry.itemId);
      if (!item) return null;
      return {
        itemId: item.id,
        brandName: item.brandName,
        genericName: item.genericName,
        qty: entry.qty,
        unitPrice: item.sellingPrice,
        total: Number((entry.qty * item.sellingPrice).toFixed(2)),
        maxQty: item.stockQty,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const cartTotal = Number(cartDetails.reduce((s, c) => s + c.total, 0).toFixed(2));

  const handleCheckout = () => {
    if (cartDetails.length === 0) return;
    const customerName =
      customerType === 'registered'
        ? patients.find((p) => p.id === selectedPatientId)?.name || 'Registered Patient'
        : walkInName.trim() || 'Walk-In Customer';

    const salePayload: Omit<PharmacySale, 'id' | 'receiptNumber' | 'createdAt'> = {
      customerName,
      customerType,
      patientId: customerType === 'registered' ? selectedPatientId : undefined,
      prescriptionId: selectedRxId || undefined,
      items: cartDetails.map(({ itemId, brandName, genericName, qty, unitPrice, total }) => ({
        itemId,
        brandName,
        genericName,
        qty,
        unitPrice,
        total,
      })),
      subtotal: cartTotal,
      discount: 0,
      total: cartTotal,
      paymentMethod,
    };

    onCompleteSale(salePayload);
    setLastReceipt({
      ...salePayload,
      id: 'recent',
      receiptNumber: `POS-${3001 + sales.length}`,
      createdAt: new Date().toISOString(),
    });
    setCart([]);
    setSelectedRxId('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pharmacy Inventory &amp; Direct POS
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Batch valuation, 90-day expiry alerts, prescription auto-matching, and atomic stock dispensing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* Valuation Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Inventory Retail Value</p>
          <p className="text-xl font-bold font-mono tabular-nums mt-1">
            {formatCurrency(inventoryRetailValue, currency, hideFinancials)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Projected Margin</p>
          <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {formatCurrency(expectedProfit, currency, hideFinancials)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Low Stock SKUs</p>
          <p className="text-xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {lowStockCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Expiring ≤ 90 Days</p>
          <p className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {expiring90d}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg w-fit no-print">
        {[
          { id: 'inventory', label: `Inventory (${items.length})` },
          { id: 'pos', label: 'Direct POS Dispense' },
          { id: 'history', label: `Sales History (${sales.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              tab === t.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inventory' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-4">Batch / Barcode</th>
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4 text-right">Cost / Sell</th>
                <th className="py-3 px-4">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item) => {
                const days = daysUntilDate(item.expiryDate);
                const isLow = item.stockQty <= item.reorderLevel;
                return (
                  <tr key={item.id}>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {item.brandName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.genericName} · {item.manufacturer || 'Generic'}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                      <p>{item.batchNumber || '—'}</p>
                      <p className="text-slate-400">{item.barcode || '—'}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span className={isLow ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
                        {item.stockQty}
                      </span>
                      <span className="text-xs text-slate-400 block">min {item.reorderLevel}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      <p>{formatCurrency(item.sellingPrice, currency)}</p>
                      <p className="text-slate-400">
                        Cost {formatCurrency(item.purchasePrice, currency)}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums">
                      <span
                        className={
                          days <= 90
                            ? 'text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-1'
                            : 'text-slate-600 dark:text-slate-300'
                        }
                      >
                        {days <= 90 && <AlertTriangle className="w-3.5 h-3.5" />}
                        {item.expiryDate} ({days}d)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold">Select Medicines or Auto-Match Prescription</h2>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <select
                  value={selectedRxId}
                  onChange={(e) => handleAutoMatchPrescription(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="">Auto-match from Digital Rx...</option>
                  {prescriptions.map((rx) => (
                    <option key={rx.id} value={rx.id}>
                      {rx.rxNumber} — {rx.patientName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.stockQty <= 0}
                  onClick={() => addToCart(item.id)}
                  className="text-left p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.brandName}
                    </span>
                    <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(item.sellingPrice, currency)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.genericName} · <span className="font-mono">{item.stockQty} in stock</span>
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Cart & Checkout */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>Dispensing Cart</span>
              </h2>
              {lastReceipt && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print text-xs font-medium text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Last</span>
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs no-print">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerType('registered')}
                  className={`flex-1 py-1.5 rounded-md border font-medium cursor-pointer ${
                    customerType === 'registered'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Registered Patient
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerType('walk_in')}
                  className={`flex-1 py-1.5 rounded-md border font-medium cursor-pointer ${
                    customerType === 'walk_in'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Walk-In
                </button>
              </div>

              {customerType === 'registered' ? (
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.patientCode})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="Walk-in customer name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              )}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {cartDetails.length === 0 ? (
                <p className="py-6 text-center text-slate-400">
                  Click medicines on the left or auto-match an Rx.
                </p>
              ) : (
                cartDetails.map((line) => (
                  <div key={line.itemId} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {line.brandName}
                      </p>
                      <p className="text-slate-500 font-mono">
                        {formatCurrency(line.unitPrice, currency)} × {line.qty}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={line.maxQty}
                        value={line.qty}
                        onChange={(e) =>
                          setCart((prev) =>
                            prev.map((c) =>
                              c.itemId === line.itemId
                                ? {
                                    ...c,
                                    qty: Math.max(1, Math.min(line.maxQty, Number(e.target.value) || 1)),
                                  }
                                : c
                            )
                          )
                        }
                        className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-right"
                      />
                      <button
                        type="button"
                        onClick={() => setCart((prev) => prev.filter((c) => c.itemId !== line.itemId))}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 no-print">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total Due</span>
                <span className="font-mono tabular-nums">{formatCurrency(cartTotal, currency)}</span>
              </div>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PharmacySale['paymentMethod'])
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="Cash">Cash</option>
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Card">Card</option>
                <option value="Bank">Bank</option>
              </select>
              <button
                type="button"
                disabled={cartDetails.length === 0}
                onClick={handleCheckout}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                Dispense &amp; Deduct Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="py-3 px-4">Receipt</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Dispensed Items</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {sale.receiptNumber}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium">{sale.customerName}</p>
                    <p className="text-xs text-slate-500 capitalize">
                      {sale.customerType.replace('_', ' ')}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                    {sale.items.map((i) => `${i.brandName} ×${i.qty}`).join(', ')}
                  </td>
                  <td className="py-3 px-4 text-xs">{sale.paymentMethod}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    {formatCurrency(sale.total, currency, hideFinancials)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Medicine Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 no-print">
          <form
            onSubmit={handleAddStock}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-semibold">Add Pharmacy Inventory Item</h2>
              <button type="button" onClick={() => setAddModalOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <input
                required
                placeholder="Brand Name"
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                required
                placeholder="Generic Name"
                value={form.genericName}
                onChange={(e) => setForm({ ...form, genericName: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                placeholder="Batch Number"
                value={form.batchNumber}
                onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs"
              />
              <input
                placeholder="Barcode"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs"
              />
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Purchase Price</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Selling Price</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Stock Qty</span>
                <input
                  type="number"
                  min={0}
                  required
                  value={form.stockQty}
                  onChange={(e) => setForm({ ...form, stockQty: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Expiry Date</span>
                <input
                  type="date"
                  required
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                Save Medicine
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
