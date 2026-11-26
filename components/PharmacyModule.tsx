'use client';

import React, { useMemo, useState } from 'react';
import {
  Plus,
  Pill,
  X,
  AlertTriangle,
  Trash2,
  ShoppingCart,
  Printer,
  Download,
  FileText,
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  Minus,
} from 'lucide-react';
import {
  savePharmacyItem,
  removePharmacyItem,
  dispensePharmacySale,
  TenantActor,
} from '@/lib/firestore-service';
import { exportRowsToCsv, formatMoney, todayISO } from '@/lib/clinic-utils';
import type {
  Organization,
  PharmacyItem,
  Patient,
  Prescription,
  Invoice,
  InvoicePayment,
} from '@/lib/types';

interface Props {
  org: Organization;
  actor: TenantActor;
  items: PharmacyItem[];
  patients: Patient[];
  prescriptions: Prescription[];
  invoices: Invoice[];
}

type StockFilter = 'all' | 'low' | 'out' | 'expiring_soon' | 'expired';

function addDaysISO(baseISO: string, days: number): string {
  const parts = baseISO.split('-').map(Number);
  const d = new Date(parts[0], (parts[1] || 1) - 1, (parts[2] || 1) + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function PharmacyModule({
  org,
  actor,
  items,
  patients,
  prescriptions,
  invoices,
}: Props) {
  const [tab, setTab] = useState<'inventory' | 'pos' | 'sales'>('inventory');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  // Add / Edit Stock Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PharmacyItem | null>(null);
  const [brandName, setBrandName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [barcode, setBarcode] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('5');
  const [sellingPrice, setSellingPrice] = useState('7');
  const [stockQty, setStockQty] = useState('100');
  const [reorderLevel, setReorderLevel] = useState('30');
  const [expiryDate, setExpiryDate] = useState('2028-01-01');
  const [saving, setSaving] = useState(false);

  // Delete Confirmation Modal
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<PharmacyItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // POS Dispense & Cart State
  const [posSearch, setPosSearch] = useState('');
  const [customerMode, setCustomerMode] = useState<'patient' | 'walkin'>('patient');
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [walkInName, setWalkInName] = useState('Walk-In Customer');
  const [selectedRxId, setSelectedRxId] = useState('');
  const [rxMatchNote, setRxMatchNote] = useState<string | null>(null);
  const [cart, setCart] = useState<Array<{ itemId: string; qty: number }>>([]);
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<InvoicePayment['method']>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paidInput, setPaidInput] = useState('');
  const [dispensing, setDispensing] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);

  // Printable Receipt
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);

  const canDelete = actor.role === 'clinic_owner' || actor.role === 'clinic_admin';
  const today = todayISO();
  const soonCutoff = useMemo(() => addDaysISO(today, 90), [today]);

  // Inventory Metrics
  const metrics = useMemo(() => {
    let totalUnits = 0;
    let totalCostVal = 0;
    let totalRetailVal = 0;
    let lowCount = 0;
    let outCount = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;

    items.forEach((it) => {
      totalUnits += it.stockQty || 0;
      totalCostVal += (it.stockQty || 0) * (it.purchasePrice || 0);
      totalRetailVal += (it.stockQty || 0) * (it.sellingPrice || 0);
      if (it.stockQty <= 0) outCount += 1;
      else if (it.stockQty <= it.reorderLevel) lowCount += 1;

      if (it.expiryDate <= today) expiredCount += 1;
      else if (it.expiryDate <= soonCutoff) expiringSoonCount += 1;
    });

    return {
      totalSkus: items.length,
      totalUnits,
      totalCostVal,
      totalRetailVal,
      lowCount,
      outCount,
      expiredCount,
      expiringSoonCount,
    };
  }, [items, today, soonCutoff]);

  // Filtered Inventory
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (stockFilter === 'low' && !(it.stockQty > 0 && it.stockQty <= it.reorderLevel)) return false;
      if (stockFilter === 'out' && it.stockQty > 0) return false;
      if (stockFilter === 'expired' && !(it.expiryDate <= today)) return false;
      if (stockFilter === 'expiring_soon' && !(it.expiryDate > today && it.expiryDate <= soonCutoff)) return false;
      if (!q) return true;
      return (
        it.brandName.toLowerCase().includes(q) ||
        it.genericName.toLowerCase().includes(q) ||
        (it.manufacturer || '').toLowerCase().includes(q) ||
        (it.batchNumber || '').toLowerCase().includes(q) ||
        (it.barcode || '').toLowerCase().includes(q)
      );
    });
  }, [items, search, stockFilter, today, soonCutoff]);

  // Pharmacy Sales History (from invoices with category === 'pharmacy')
  const pharmacySales = useMemo(() => {
    return invoices.filter((inv) => inv.items.some((li) => li.category === 'pharmacy'));
  }, [invoices]);

  // POS Catalog Search
  const posCatalog = useMemo(() => {
    const q = posSearch.trim().toLowerCase();
    return items.filter((it) => {
      if (!q) return true;
      return (
        it.brandName.toLowerCase().includes(q) ||
        it.genericName.toLowerCase().includes(q) ||
        (it.barcode || '').toLowerCase().includes(q)
      );
    });
  }, [items, posSearch]);

  // Resolved Cart Lines (bound to live inventory stock)
  const resolvedCart = useMemo(() => {
    return cart
      .map((c) => {
        const item = items.find((i) => i.id === c.itemId);
        if (!item) return null;
        return { item, qty: Math.min(c.qty, Math.max(1, item.stockQty)) };
      })
      .filter((x): x is { item: PharmacyItem; qty: number } => Boolean(x));
  }, [cart, items]);

  const posTotals = useMemo(() => {
    const subtotal = Math.round(resolvedCart.reduce((s, l) => s + l.qty * l.item.sellingPrice, 0) * 100) / 100;
    const disc = Math.max(0, Math.min(subtotal, Number(discount || 0)));
    const taxable = Math.max(0, subtotal - disc);
    const rate = Math.max(0, Math.min(100, Number(taxRate || 0)));
    const taxAmount = Math.round(((taxable * rate) / 100) * 100) / 100;
    const grandTotal = Math.round((taxable + taxAmount) * 100) / 100;
    return { subtotal, disc, taxAmount, grandTotal };
  }, [resolvedCart, discount, taxRate]);

  // Stock CRUD handlers
  const openModal = (item?: PharmacyItem) => {
    setEditing(item || null);
    setBrandName(item?.brandName || '');
    setGenericName(item?.genericName || '');
    setManufacturer(item?.manufacturer || '');
    setBatchNumber(item?.batchNumber || '');
    setBarcode(item?.barcode || '');
    setSupplierName(item?.supplierName || '');
    setPurchasePrice(String(item?.purchasePrice ?? 5));
    setSellingPrice(String(item?.sellingPrice ?? 7));
    setStockQty(String(item?.stockQty ?? 100));
    setReorderLevel(String(item?.reorderLevel ?? 30));
    setExpiryDate(item?.expiryDate || '2028-01-01');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await savePharmacyItem(org, actor, {
        id: editing?.id,
        brandName,
        genericName,
        manufacturer,
        batchNumber,
        barcode,
        supplierName,
        purchasePrice: Number(purchasePrice || 0),
        sellingPrice: Number(sellingPrice || 0),
        stockQty: Number(stockQty || 0),
        reorderLevel: Number(reorderLevel || 0),
        expiryDate,
        status: 'active',
      });
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const adjustStock = async (item: PharmacyItem, delta: number) => {
    await savePharmacyItem(org, actor, {
      ...item,
      stockQty: Math.max(0, item.stockQty + delta),
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteItem) return;
    setDeleting(true);
    try {
      await removePharmacyItem(org, actor, confirmDeleteItem.id, confirmDeleteItem.brandName);
      setCart((prev) => prev.filter((c) => c.itemId !== confirmDeleteItem.id));
      if (editing?.id === confirmDeleteItem.id) {
        setShowModal(false);
        setEditing(null);
      }
      setConfirmDeleteItem(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `${org.slug}-pharmacy-inventory.csv`,
      [
        'Brand Name',
        'Generic Name',
        'Manufacturer',
        'Supplier',
        'Batch #',
        'Barcode',
        'Purchase Price',
        'Selling Price',
        'Profit Margin %',
        'Stock Qty',
        'Reorder Level',
        'Expiry Date',
        'Status',
      ],
      filtered.map((it) => {
        const marginPct =
          it.purchasePrice > 0
            ? Math.round(((it.sellingPrice - it.purchasePrice) / it.purchasePrice) * 100)
            : 0;
        const statusLabel =
          it.expiryDate <= today
            ? 'Expired'
            : it.stockQty <= 0
              ? 'Out of Stock'
              : it.stockQty <= it.reorderLevel
                ? 'Low Stock'
                : it.expiryDate <= soonCutoff
                  ? 'Expiring Soon'
                  : 'In Stock';
        return [
          it.brandName,
          it.genericName,
          it.manufacturer || '',
          it.supplierName || '',
          it.batchNumber || '',
          it.barcode || '',
          it.purchasePrice,
          it.sellingPrice,
          `${marginPct}%`,
          it.stockQty,
          it.reorderLevel,
          it.expiryDate,
          statusLabel,
        ];
      })
    );
  };

  // POS Cart Handlers
  const addToCart = (item: PharmacyItem, jumpToPos = false) => {
    if (item.stockQty <= 0) {
      setPosError(`${item.brandName} is currently out of stock.`);
      return;
    }
    setPosError(null);
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        if (existing.qty >= item.stockQty) return prev;
        return prev.map((c) => (c.itemId === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { itemId: item.id, qty: 1 }];
    });
    if (jumpToPos) setTab('pos');
  };

  const updateCartQty = (itemId: string, nextQty: number) => {
    const invItem = items.find((i) => i.id === itemId);
    if (!invItem) return;
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((c) => c.itemId !== itemId));
      return;
    }
    const clamped = Math.min(nextQty, invItem.stockQty);
    setCart((prev) => prev.map((c) => (c.itemId === itemId ? { ...c, qty: clamped } : c)));
  };

  const handleLoadPrescription = (rxId: string) => {
    setSelectedRxId(rxId);
    setRxMatchNote(null);
    setPosError(null);
    if (!rxId) return;
    const rx = prescriptions.find((r) => r.id === rxId);
    if (!rx) return;

    // Bind patient automatically if present
    const pat = patients.find((p) => p.id === rx.patientId);
    if (pat) {
      setCustomerMode('patient');
      setSelectedPatientId(pat.id);
    } else {
      setCustomerMode('walkin');
      setWalkInName(rx.patientName);
    }

    // Match prescribed medicines against in-stock non-expired pharmacy inventory
    const matchedIds: Array<{ itemId: string; qty: number }> = [];
    const unmatchedNames: string[] = [];

    rx.medicines.forEach((med) => {
      const mName = med.name.toLowerCase();
      const mGen = (med.genericName || '').toLowerCase();
      const hit = items.find(
        (it) =>
          it.stockQty > 0 &&
          it.expiryDate > today &&
          (it.brandName.toLowerCase().includes(mName) ||
            mName.includes(it.brandName.toLowerCase()) ||
            (mGen && it.genericName.toLowerCase().includes(mGen)))
      );
      if (hit) {
        if (!matchedIds.some((x) => x.itemId === hit.id)) {
          matchedIds.push({ itemId: hit.id, qty: 1 });
        }
      } else {
        unmatchedNames.push(med.name);
      }
    });

    if (matchedIds.length > 0) {
      setCart((prev) => {
        const next = [...prev];
        matchedIds.forEach((m) => {
          if (!next.some((x) => x.itemId === m.itemId)) next.push(m);
        });
        return next;
      });
    }

    if (matchedIds.length > 0 && unmatchedNames.length === 0) {
      setRxMatchNote(`Loaded all ${matchedIds.length} prescribed medicine(s) from ${rx.rxNumber}.`);
    } else if (matchedIds.length > 0) {
      setRxMatchNote(
        `Matched ${matchedIds.length} medicine(s) from ${rx.rxNumber}. Not in stock: ${unmatchedNames.join(', ')}.`
      );
    } else {
      setRxMatchNote(`No medicines from ${rx.rxNumber} matched available in-stock inventory.`);
    }
  };

  const handleCompleteSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resolvedCart.length === 0) {
      setPosError('Add at least one medicine to the cart before dispensing.');
      return;
    }

    const activePat = customerMode === 'patient' ? patients.find((p) => p.id === selectedPatientId) : undefined;
    const rxObj = selectedRxId ? prescriptions.find((r) => r.id === selectedRxId) : undefined;
    const resolvedPaid = paidInput.trim() === '' ? posTotals.grandTotal : Number(paidInput);

    setDispensing(true);
    setPosError(null);
    try {
      const createdInvoice = await dispensePharmacySale(
        org,
        actor,
        {
          patientId: activePat ? activePat.id : 'walkin_customer',
          patientName: activePat ? activePat.name : walkInName.trim() || 'Walk-In Customer',
          patientCode: activePat?.patientCode,
          patientAuthUid: activePat?.patientAuthUid,
          cart: resolvedCart,
          discount: Number(discount || 0),
          taxRate: Number(taxRate || 0),
          paymentMethod,
          paidAmountInput: resolvedPaid,
          paymentReference: paymentRef.trim() || (rxObj ? `Rx ${rxObj.rxNumber}` : 'Pharmacy Counter'),
          prescriptionRef: rxObj?.rxNumber,
        },
        invoices.length + 1
      );

      setCart([]);
      setDiscount('0');
      setTaxRate('0');
      setPaymentRef('');
      setPaidInput('');
      setSelectedRxId('');
      setRxMatchNote(null);
      setReceiptInvoice(createdInvoice);
    } catch (err) {
      setPosError(err instanceof Error ? err.message : 'Unable to complete pharmacy dispense.');
    } finally {
      setDispensing(false);
    }
  };

  // Printable Pharmacy Sales Receipt View
  if (receiptInvoice) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 no-print">
          <button
            type="button"
            onClick={() => setReceiptInvoice(null)}
            className="text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            ← Back to Pharmacy
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setReceiptInvoice(null);
                setTab('pos');
              }}
              className="px-3.5 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
            >
              New Sale
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF Receipt
            </button>
          </div>
        </div>

        <div className="bg-white text-slate-900 border border-slate-200 rounded-xl p-6 sm:p-8 max-w-2xl mx-auto print-sheet space-y-5">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <h1 className="text-lg font-bold">{org.name} — Pharmacy</h1>
              <p className="text-xs text-slate-600">{org.address}</p>
              <p className="text-xs text-slate-600 font-mono">{org.phone}</p>
            </div>
            <div className="text-right text-xs font-mono">
              <p className="font-bold text-sm">PHARMACY RECEIPT</p>
              <p>{receiptInvoice.invoiceNumber}</p>
              <p className="uppercase font-semibold text-emerald-800">{receiptInvoice.status}</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <div>
              <p className="text-slate-500">Customer / Patient</p>
              <p className="font-bold text-sm">{receiptInvoice.patientName}</p>
              {receiptInvoice.patientCode && <p className="font-mono text-slate-600">{receiptInvoice.patientCode}</p>}
            </div>
            <div className="text-right font-mono">
              <p className="text-slate-500">Date</p>
              <p>{today}</p>
              <p className="text-slate-500 mt-1">Dispensed by: {actor.name}</p>
            </div>
          </div>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-y border-slate-300 text-slate-600">
                <th className="py-2 text-left">Medicine</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {receiptInvoice.items.map((it, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 font-medium">{it.description}</td>
                  <td className="py-2.5 text-right font-mono">{it.qty}</td>
                  <td className="py-2.5 text-right font-mono">{formatMoney(it.unitPrice, org.currency)}</td>
                  <td className="py-2.5 text-right font-mono font-semibold">{formatMoney(it.total, org.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatMoney(receiptInvoice.subtotal, org.currency)}</span>
              </div>
              {receiptInvoice.discount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discount</span>
                  <span>-{formatMoney(receiptInvoice.discount, org.currency)}</span>
                </div>
              )}
              {receiptInvoice.taxAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({receiptInvoice.taxRate}%)</span>
                  <span>{formatMoney(receiptInvoice.taxAmount, org.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-1.5">
                <span>Total</span>
                <span>{formatMoney(receiptInvoice.totalAmount, org.currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Paid</span>
                <span>{formatMoney(receiptInvoice.paidAmount, org.currency)}</span>
              </div>
              {receiptInvoice.dueAmount > 0 && (
                <div className="flex justify-between text-red-700 font-bold">
                  <span>Balance Due</span>
                  <span>{formatMoney(receiptInvoice.dueAmount, org.currency)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 text-center">
            {org.invoiceFooter || 'Thank you for visiting our clinic pharmacy. Stock quantities updated automatically.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setStockFilter('all');
            setTab('inventory');
          }}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 rounded-xl p-4 transition-colors"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Medicines</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {metrics.totalSkus}
          </p>
          <p className="text-xs text-slate-500 font-mono mt-1">{metrics.totalUnits.toLocaleString()} units in stock</p>
        </button>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Inventory Valuation</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {formatMoney(metrics.totalRetailVal, org.currency)}
          </p>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Cost: {formatMoney(metrics.totalCostVal, org.currency)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setStockFilter(metrics.outCount > 0 ? 'out' : 'low');
            setTab('inventory');
          }}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 rounded-xl p-4 transition-colors"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">Low / Out of Stock</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${metrics.lowCount + metrics.outCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
            {metrics.lowCount + metrics.outCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.outCount} out · {metrics.lowCount} low stock
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStockFilter(metrics.expiredCount > 0 ? 'expired' : 'expiring_soon');
            setTab('inventory');
          }}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-500 rounded-xl p-4 transition-colors"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">Expiry Alerts</p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${metrics.expiredCount > 0 ? 'text-red-600 dark:text-red-400' : metrics.expiringSoonCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
            {metrics.expiredCount + metrics.expiringSoonCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.expiredCount} expired · {metrics.expiringSoonCount} ≤ 90 days
          </p>
        </button>
      </div>

      {/* Mode Tabs & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('inventory')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'inventory'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Inventory ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('pos')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'pos'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>POS Dispense{resolvedCart.length > 0 ? ` (${resolvedCart.length})` : ''}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('sales')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'sales'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Sales History ({pharmacySales.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === 'inventory' && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" /> Add Medicine Stock
          </button>
        </div>
      </div>

      {/* TAB 1: INVENTORY & STOCK */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search brand, generic, batch, or scan barcode..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as StockFilter)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
            >
              <option value="all">All Stock ({items.length})</option>
              <option value="low">Low Stock ({metrics.lowCount})</option>
              <option value="out">Out of Stock ({metrics.outCount})</option>
              <option value="expiring_soon">Expiring ≤ 90 Days ({metrics.expiringSoonCount})</option>
              <option value="expired">Expired ({metrics.expiredCount})</option>
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Pill className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-500">No pharmacy stock items match this filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">Medicine & Generic</th>
                      <th className="py-3 px-4 font-medium">Batch / Barcode</th>
                      <th className="py-3 px-4 font-medium text-right">Buy / Sell & Margin</th>
                      <th className="py-3 px-4 font-medium text-right">Stock</th>
                      <th className="py-3 px-4 font-medium">Expiry</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filtered.map((item) => {
                      const out = item.stockQty <= 0;
                      const low = !out && item.stockQty <= item.reorderLevel;
                      const expired = item.expiryDate <= today;
                      const expiringSoon = !expired && item.expiryDate <= soonCutoff;
                      const marginPct =
                        item.purchasePrice > 0
                          ? Math.round(((item.sellingPrice - item.purchasePrice) / item.purchasePrice) * 100)
                          : 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-900 dark:text-white">{item.brandName}</p>
                            <p className="text-xs text-slate-500">
                              {item.genericName} · {item.manufacturer || '—'}
                              {item.supplierName ? ` · ${item.supplierName}` : ''}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {item.batchNumber || '—'} {item.barcode ? `· ${item.barcode}` : ''}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                            <p>
                              {formatMoney(item.purchasePrice, org.currency)} /{' '}
                              <strong className="text-slate-900 dark:text-white">
                                {formatMoney(item.sellingPrice, org.currency)}
                              </strong>
                            </p>
                            <p className={`text-[11px] ${marginPct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
                              {marginPct >= 0 ? `+${marginPct}%` : `${marginPct}%`} margin
                            </p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                            <span
                              className={
                                out || low
                                  ? 'text-red-600 font-bold'
                                  : 'text-teal-700 dark:text-teal-400 font-semibold'
                              }
                            >
                              {item.stockQty}
                            </span>
                            {out && <span className="block text-[11px] text-red-600 font-medium">Out of Stock</span>}
                            {low && (
                              <span className="block text-[11px] text-amber-600 dark:text-amber-400">
                                Low (≤{item.reorderLevel})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                            <span
                              className={
                                expired
                                  ? 'text-red-600 font-semibold inline-flex items-center gap-1'
                                  : expiringSoon
                                    ? 'text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-1'
                                    : 'text-slate-600 dark:text-slate-400'
                              }
                            >
                              {expired && <AlertTriangle className="w-3.5 h-3.5" />}
                              {expiringSoon && <Clock className="w-3.5 h-3.5" />}
                              {item.expiryDate}
                            </span>
                            {expired && <span className="block text-[11px] text-red-600">Expired</span>}
                            {expiringSoon && <span className="block text-[11px] text-amber-600 dark:text-amber-400">Expiring Soon</span>}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => addToCart(item, true)}
                                disabled={out || expired}
                                title={expired ? 'Cannot sell expired medicine' : out ? 'Out of stock' : 'Sell / Dispense'}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-40"
                              >
                                <ShoppingCart className="w-3 h-3" /> Sell
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustStock(item, -1)}
                                className="px-2 py-1 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustStock(item, 10)}
                                className="px-2 py-1 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                +10
                              </button>
                              <button
                                type="button"
                                onClick={() => openModal(item)}
                                className="px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                              >
                                Edit
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteItem(item)}
                                  title="Delete Product"
                                  aria-label={`Delete ${item.brandName}`}
                                  className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: POS DISPENSE & BILLING */}
      {tab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Medicine Picker + Prescription Handoff */}
          <div className="lg:col-span-7 space-y-4">
            {/* Load from Doctor Prescription */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Dispense From Digital Prescription (Optional)</span>
              </div>
              <select
                value={selectedRxId}
                onChange={(e) => handleLoadPrescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="">Select a prescription to auto-match medicines...</option>
                {prescriptions.slice(0, 40).map((rx) => (
                  <option key={rx.id} value={rx.id}>
                    {rx.rxNumber} — {rx.patientName} ({rx.doctorName} · {rx.medicines.length} meds)
                  </option>
                ))}
              </select>
              {rxMatchNote && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {rxMatchNote}
                </p>
              )}
            </div>

            {/* Catalog Picker */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                  placeholder="Search medicine by brand, generic, or barcode..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                {posCatalog.map((item) => {
                  const expired = item.expiryDate <= today;
                  const out = item.stockQty <= 0;
                  const inCart = cart.find((c) => c.itemId === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={out || expired}
                      onClick={() => addToCart(item)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        inCart
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500 bg-white dark:bg-slate-950/60'
                      } disabled:opacity-45 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {item.brandName}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{item.genericName}</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                          {formatMoney(item.sellingPrice, org.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[11px] font-mono">
                        <span className={out ? 'text-red-600' : 'text-slate-500'}>
                          Stock: {item.stockQty}
                        </span>
                        {expired ? (
                          <span className="text-red-600 font-semibold">Expired</span>
                        ) : inCart ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            In Cart: {inCart.qty}
                          </span>
                        ) : (
                          <span className="text-slate-400">Exp {item.expiryDate}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {posCatalog.length === 0 && (
                  <p className="col-span-2 text-center text-xs text-slate-500 py-8">
                    No matching medicines found in inventory.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Dispense Cart & Checkout */}
          <form
            onSubmit={handleCompleteSale}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 self-start"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                Dispense Cart ({resolvedCart.length})
              </h3>
              {resolvedCart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-red-600 hover:underline"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {posError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {posError}
              </div>
            )}

            {/* Customer Selector */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setCustomerMode('patient')}
                  className={`py-1.5 rounded-md font-medium ${
                    customerMode === 'patient'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Registered Patient
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('walkin')}
                  className={`py-1.5 rounded-md font-medium ${
                    customerMode === 'walkin'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Walk-In Customer
                </button>
              </div>

              {customerMode === 'patient' ? (
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="">Select Patient...</option>
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
                  placeholder="Customer full name"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              )}
            </div>

            {/* Cart Items */}
            <div className="border-y border-slate-200 dark:border-slate-800 py-3 space-y-2.5 max-h-60 overflow-y-auto">
              {resolvedCart.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Click medicines on the left or load a prescription to build the dispense cart.
                </p>
              ) : (
                resolvedCart.map(({ item, qty }) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-white truncate">{item.brandName}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {formatMoney(item.sellingPrice, org.currency)} × {qty} (Max {item.stockQty})
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, qty - 1)}
                        className="p-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={item.stockQty}
                        value={qty}
                        onChange={(e) => updateCartQty(item.id, Number(e.target.value || 1))}
                        className="w-12 text-center py-0.5 font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.id, qty + 1)}
                        disabled={qty >= item.stockQty}
                        className="p-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-mono font-semibold w-16 text-right shrink-0">
                      {formatMoney(qty * item.sellingPrice, org.currency)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Discount / Tax / Payment */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block mb-1 text-slate-600 dark:text-slate-400">Discount</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-600 dark:text-slate-400">Tax %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-600 dark:text-slate-400">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as InvoicePayment['method'])}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_banking">Mobile Banking</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-slate-600 dark:text-slate-400">
                  Paid Now (blank = full)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={paidInput}
                  onChange={(e) => setPaidInput(e.target.value)}
                  placeholder={String(posTotals.grandTotal)}
                  className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span>{formatMoney(posTotals.subtotal, org.currency)}</span>
              </div>
              {posTotals.disc > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Discount</span>
                  <span>-{formatMoney(posTotals.disc, org.currency)}</span>
                </div>
              )}
              {posTotals.taxAmount > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tax</span>
                  <span>{formatMoney(posTotals.taxAmount, org.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-1.5">
                <span>Grand Total</span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  {formatMoney(posTotals.grandTotal, org.currency)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={dispensing || resolvedCart.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#047857] hover:bg-[#065f46] text-white rounded-lg disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {dispensing ? 'Dispensing & Updating Stock...' : 'Complete Sale & Print Receipt'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: SALES & DISPENSE HISTORY */}
      {tab === 'sales' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {pharmacySales.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Receipt className="w-7 h-7 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-500">No pharmacy sales recorded yet.</p>
              <button
                type="button"
                onClick={() => setTab('pos')}
                className="px-4 py-2 text-xs font-medium bg-[#047857] text-white rounded-lg"
              >
                Open POS Dispense
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-medium">Receipt #</th>
                    <th className="py-3 px-4 font-medium">Customer / Patient</th>
                    <th className="py-3 px-4 font-medium">Dispensed Medicines</th>
                    <th className="py-3 px-4 font-medium text-right">Total / Paid</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {pharmacySales.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-white">{inv.patientName}</p>
                        <p className="text-xs font-mono text-slate-500">{inv.patientCode || 'WALK-IN'}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {inv.items
                          .filter((li) => li.category === 'pharmacy')
                          .map((li) => `${li.description} (×${li.qty})`)
                          .join(', ')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {formatMoney(inv.totalAmount, org.currency)}
                        </p>
                        <p className="text-emerald-700 dark:text-emerald-400">
                          Paid {formatMoney(inv.paidAmount, org.currency)}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs capitalize font-medium">{inv.status}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setReceiptInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-md"
                        >
                          <Printer className="w-3.5 h-3.5" /> Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Stock Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Medicine Stock' : 'Add Medicine to Inventory'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1">Brand Name *</label>
                  <input required value={brandName} onChange={(e) => setBrandName(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Generic Name *</label>
                  <input required value={genericName} onChange={(e) => setGenericName(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Manufacturer</label>
                  <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Supplier</label>
                  <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Batch #</label>
                  <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Barcode</label>
                  <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Purchase Price</label>
                  <input type="number" step="0.01" min={0} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Selling Price</label>
                  <input type="number" step="0.01" min={0} value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Stock Qty</label>
                  <input type="number" min={0} value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Reorder Alert Level</label>
                  <input type="number" min={0} value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs mb-1">Expiry Date *</label>
                  <input type="date" required value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  {editing && canDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteItem(editing)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-medium bg-[#047857] hover:bg-[#065f46] text-white rounded-lg">
                    {saving ? 'Saving...' : 'Save Stock'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 sm:p-6 my-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Pharmacy Product</h3>
                  <p className="text-xs text-slate-500">This action permanently removes the item from inventory.</p>
                </div>
              </div>
              <button type="button" onClick={() => setConfirmDeleteItem(null)} disabled={deleting}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">{confirmDeleteItem.brandName}</p>
              <p className="text-slate-500">
                {confirmDeleteItem.genericName}
                {confirmDeleteItem.batchNumber ? ` · Batch ${confirmDeleteItem.batchNumber}` : ''}
                {` · Stock: ${confirmDeleteItem.stockQty}`}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
