import { Component, inject, input, signal, effect } from '@angular/core';
import { DatePipe, LowerCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { OrderDetail, OrderStatus, PaymentMethod, Vendor } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES, isoDate } from '../../shared/pipes';
import { ModalComponent } from '../../shared/ui';

@Component({
  selector: 'wc-order-detail',
  imports: [FormsModule, RouterLink, DatePipe, LowerCasePipe, ModalComponent, ...SHARED_PIPES],
  templateUrl: './order-detail.html'
})
export class OrderDetailPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly id = input.required<string>();

  protected o = signal<OrderDetail | null>(null);
  protected vendors = signal<Vendor[]>([]);
  protected modal = signal<'' | 'status' | 'payment' | 'po' | 'bill' | 'refund' | 'note' | 'delivery'>('');
  protected busy = signal(false);
  protected vendorMessage = signal<{ text: string; whatsAppUrl: string } | null>(null);

  statusForm = { status: '' as OrderStatus | '', note: '', visibleToCustomer: true, trackingNumber: '', courierName: '', expectedDeliveryDate: '', collectCod: true };
  paymentForm = { method: 'Upi' as PaymentMethod, amount: 0, reference: '', paidAt: isoDate(new Date()), notes: '' };
  poForm = { vendorId: 0, status: 'Sent', expectedCost: 0, vendorReference: '', notes: '', expectedDispatchDate: '' };
  billForm = { billNumber: '', billDate: isoDate(new Date()), taxableAmount: 0, gstAmount: 0, shippingCharges: 0, fileUrl: '', notes: '' };
  refundForm = { type: 'Partial', amount: 0, reason: '' };
  noteForm = { note: '', visibleToCustomer: false };
  deliveryForm = { date: '', reason: '', notify: true };
  protected readonly delayReasons = [
    'The vendor needs more time to finish making your furniture.',
    'Delay in transport from the workshop.',
    'Festival / public holiday at the workshop.',
    'Heavy rain — deliveries are delayed in your area.',
    'Waiting for material (wood/fabric) to arrive.'
  ];
  adminNotes = '';

  constructor() {
    effect(() => this.load(this.id()));
    this.api.get<Vendor[]>('admin/vendors').subscribe(v => this.vendors.set(v));
  }

  load(id: string) {
    this.api.get<OrderDetail>(`admin/orders/${id}`).subscribe(o => this.set(o));
  }

  private set(o: OrderDetail) {
    this.o.set(o);
    this.adminNotes = o.adminNotes ?? '';
    this.vendorMessage.set(null);
  }

  // ----- Status -----
  openStatus(status: OrderStatus) {
    const o = this.o()!;
    this.statusForm = {
      status, note: '', visibleToCustomer: true, trackingNumber: o.trackingNumber ?? '', courierName: o.courierName ?? '',
      expectedDeliveryDate: o.expectedDeliveryDate?.slice(0, 10) ?? '', collectCod: o.amountPaid < o.total
    };
    this.modal.set('status');
  }

  saveStatus() {
    const f = this.statusForm;
    this.busy.set(true);
    this.api.put<OrderDetail>(`admin/orders/${this.o()!.id}/status`, {
      ...f, note: f.note || null, trackingNumber: f.trackingNumber || null, courierName: f.courierName || null,
      expectedDeliveryDate: f.expectedDeliveryDate || null
    }).subscribe({
      next: o => { this.set(o); this.modal.set(''); this.busy.set(false); this.toast.success('Order updated'); },
      error: () => this.busy.set(false)
    });
  }

  // ----- Delivery date -----
  canChangeDate(o: OrderDetail) { return !['Delivered', 'Cancelled', 'Returned'].includes(o.status); }

  openDeliveryDate() {
    const o = this.o()!;
    this.deliveryForm = { date: o.expectedDeliveryDate?.slice(0, 10) ?? '', reason: '', notify: true };
    this.modal.set('delivery');
  }

  /** Later than the current date — the customer must be told why. */
  isLater() {
    const cur = this.o()?.expectedDeliveryDate?.slice(0, 10);
    return !!cur && !!this.deliveryForm.date && this.deliveryForm.date > cur;
  }

  todayIso() { return isoDate(new Date()); }

  saveDeliveryDate() {
    const f = this.deliveryForm;
    this.busy.set(true);
    this.api.put<OrderDetail>(`admin/orders/${this.o()!.id}/delivery-date`, { date: f.date, reason: f.reason || null, notifyCustomer: f.notify }).subscribe({
      next: o => { this.set(o); this.modal.set(''); this.busy.set(false); this.toast.success(f.notify ? 'Delivery date updated — customer notified' : 'Delivery date updated'); },
      error: () => this.busy.set(false)
    });
  }

  // ----- Vendor -----
  loadVendorMessage() {
    this.api.get<{ text: string; whatsAppUrl: string }>(`admin/orders/${this.o()!.id}/vendor-message`).subscribe(m => this.vendorMessage.set(m));
  }

  copyMessage() {
    navigator.clipboard.writeText(this.vendorMessage()!.text).then(() => this.toast.success('Copied to clipboard'));
  }

  openPo() {
    const o = this.o()!;
    const po = o.purchaseOrder;
    this.poForm = {
      vendorId: po?.vendorId ?? this.vendors()[0]?.id ?? 0, status: po?.status ?? 'Sent',
      expectedCost: po?.expectedCost ?? o.estimatedCost, vendorReference: po?.vendorReference ?? '', notes: po?.notes ?? '',
      expectedDispatchDate: po?.expectedDispatchDate?.slice(0, 10) ?? ''
    };
    this.modal.set('po');
  }

  savePo() {
    const f = this.poForm;
    this.api.put<OrderDetail>(`admin/orders/${this.o()!.id}/purchase-order`, { ...f, expectedDispatchDate: f.expectedDispatchDate || null })
      .subscribe(o => { this.set(o); this.modal.set(''); this.toast.success('Purchase order saved'); });
  }

  poPdf() {
    const o = this.o()!;
    this.api.download(`admin/orders/${o.id}/purchase-order/pdf`, `PO-${o.orderNumber}.pdf`, undefined, true);
    setTimeout(() => this.load(String(o.id)), 1500);
  }

  // ----- Vendor bill -----
  openBill() {
    const o = this.o()!;
    const cost = o.purchaseOrder?.expectedCost ?? o.estimatedCost;
    // Vendor bill = vendor prices (taxable) + GST on top.
    const base = o.items.reduce((s, i) => s + (i.unitVendorPrice || i.unitVendorCost / (1 + i.gstRate / 100)) * i.quantity, 0);
    const taxable = Math.round(Math.min(base, cost) * 100) / 100;
    this.billForm = { billNumber: '', billDate: isoDate(new Date()), taxableAmount: taxable, gstAmount: Math.round((cost - taxable) * 100) / 100, shippingCharges: 0, fileUrl: '', notes: '' };
    this.modal.set('bill');
  }

  uploadBillFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.upload<{ url: string }>('admin/uploads', file, 'file', { folder: 'bills' }).subscribe(r => { this.billForm.fileUrl = r.url; this.toast.success('File attached'); });
  }

  saveBill() {
    const o = this.o()!;
    const vendorId = o.purchaseOrder?.vendorId ?? this.vendors()[0]?.id;
    this.api.post('admin/vendor-bills', { ...this.billForm, vendorId, orderId: o.id, fileUrl: this.billForm.fileUrl || null })
      .subscribe(() => { this.modal.set(''); this.toast.success('Vendor bill recorded'); this.load(String(o.id)); });
  }

  // ----- Payments / invoice / refunds -----
  openPayment() {
    const o = this.o()!;
    this.paymentForm = { method: 'Upi', amount: Math.max(0, o.total - o.amountPaid), reference: '', paidAt: isoDate(new Date()), notes: '' };
    this.modal.set('payment');
  }

  savePayment() {
    this.api.post<OrderDetail>(`admin/orders/${this.o()!.id}/payments`, this.paymentForm)
      .subscribe(o => { this.set(o); this.modal.set(''); this.toast.success('Payment recorded'); });
  }

  generateInvoice() {
    this.api.post<OrderDetail>(`admin/orders/${this.o()!.id}/invoice`, {}).subscribe(o => { this.set(o); this.toast.success('Invoice generated'); });
  }

  invoicePdf(id: number, number: string) {
    this.api.download(`admin/invoices/${id}/pdf`, `${number.replace(/\//g, '-')}.pdf`, undefined, true);
  }

  openRefund() {
    const o = this.o()!;
    this.refundForm = { type: 'Partial', amount: o.amountPaid, reason: '' };
    this.modal.set('refund');
  }

  saveRefund() {
    this.api.post('admin/refunds', { orderId: this.o()!.id, ...this.refundForm }).subscribe(() => {
      this.modal.set(''); this.toast.success('Refund created — process it from Returns & refunds'); this.load(String(this.o()!.id));
    });
  }

  saveNote() {
    this.api.post<OrderDetail>(`admin/orders/${this.o()!.id}/notes`, this.noteForm).subscribe(o => { this.set(o); this.modal.set(''); this.noteForm = { note: '', visibleToCustomer: false }; });
  }

  saveAdminNotes() {
    this.api.put(`admin/orders/${this.o()!.id}/admin-notes`, { adminNotes: this.adminNotes }).subscribe(() => this.toast.success('Notes saved'));
  }

  hasActiveInvoice(o: OrderDetail) { return o.invoices.some(i => !i.isCancelled); }

  margin(o: OrderDetail) {
    const revenue = o.total - o.taxAmount;
    return revenue ? Math.round((o.estimatedProfit / revenue) * 1000) / 10 : 0;
  }

  statusIcon(s: OrderStatus) {
    return ({ Confirmed: 'bi-check2-circle', PlacedWithVendor: 'bi-send', Dispatched: 'bi-truck', OutForDelivery: 'bi-geo-alt', Delivered: 'bi-house-check', Cancelled: 'bi-x-circle', Returned: 'bi-arrow-counterclockwise' } as Record<string, string>)[s] ?? 'bi-circle';
  }
}
