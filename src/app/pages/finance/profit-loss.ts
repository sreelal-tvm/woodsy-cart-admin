import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ProfitLoss } from '../../core/models';
import { SHARED_PIPES, isoDate } from '../../shared/pipes';
import { CHART_COLORS, ChartComponent, ChartOption } from '../../shared/ui';

@Component({
  selector: 'wc-profit-loss',
  imports: [FormsModule, RouterLink, DatePipe, ChartComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
      <div>
        <h2 class="page-title">Profit & loss</h2>
        <p class="page-subtitle mb-0">Revenue is counted when an order is delivered. Cost uses the vendor bill, or the vendor's price when no bill is entered yet.</p>
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center no-print">
        <select class="form-select form-select-sm w-auto" [(ngModel)]="preset" (change)="applyPreset()">
          <option value="month">This month</option><option value="last-month">Last month</option><option value="quarter">Last 3 months</option>
          <option value="fy">This financial year</option><option value="custom">Custom</option>
        </select>
        <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="from" (change)="preset = 'custom'; load()" />
        <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="to" (change)="preset = 'custom'; load()" />
        <button class="btn btn-sm btn-phoenix-secondary" (click)="api.download('admin/reports/profit-loss/export', 'profit-loss.csv', { from, to })"><i class="bi bi-download me-1"></i>CSV</button>
        <button class="btn btn-sm btn-phoenix-secondary" (click)="print()"><i class="bi bi-printer me-1"></i>Print</button>
      </div>
    </div>

    @if (d(); as d) {
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><div class="card card-body"><div class="kpi-label">Net revenue</div><div class="kpi-value">{{ d.netRevenue | inr }}</div><div class="text-muted fs-8">{{ d.ordersCount }} delivered orders</div></div></div>
        <div class="col-6 col-lg-3"><div class="card card-body"><div class="kpi-label">Gross profit</div><div class="kpi-value" [class.text-danger]="d.grossProfit < 0">{{ d.grossProfit | inr }}</div><div class="text-muted fs-8">{{ d.grossMarginPercent }}% margin</div></div></div>
        <div class="col-6 col-lg-3"><div class="card card-body"><div class="kpi-label">Expenses</div><div class="kpi-value">{{ d.totalExpenses | inr }}</div><div class="text-muted fs-8"><a routerLink="/expenses">Manage expenses</a></div></div></div>
        <div class="col-6 col-lg-3"><div class="card card-body" [class.border-success]="d.netProfit >= 0" [class.border-danger]="d.netProfit < 0"><div class="kpi-label">Net profit</div><div class="kpi-value" [class.text-success]="d.netProfit >= 0" [class.text-danger]="d.netProfit < 0">{{ d.netProfit | inr }}</div><div class="text-muted fs-8">{{ d.netMarginPercent }}% of revenue</div></div></div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-xl-5">
          <div class="card h-100">
            <div class="card-header"><h5 class="mb-0">Statement</h5><div class="text-muted fs-8">{{ d.from | date: 'dd MMM yyyy' }} – {{ toLabel(d.to) | date: 'dd MMM yyyy' }}</div></div>
            <div class="card-body fs-7">
              <table class="table table-sm mb-0">
                <tbody>
                  <tr><td>Gross sales (incl. GST)</td><td class="text-end">{{ d.grossSales | inr: true }}</td></tr>
                  @if (d.offerDiscounts || d.couponDiscounts) {
                    <tr><td class="ps-3 text-muted fs-8" colspan="2"><i class="bi bi-tag me-1"></i>Already after discounts:
                      @if (d.offerDiscounts) { festival offers {{ d.offerDiscounts | inr }} }
                      @if (d.offerDiscounts && d.couponDiscounts) { · }
                      @if (d.couponDiscounts) { coupons {{ d.couponDiscounts | inr }} }
                    </td></tr>
                  }
                  @if (d.gstRegistered) { <tr><td class="ps-3 text-muted">Less: GST collected</td><td class="text-end text-muted">−{{ d.outputGst | inr: true }}</td></tr> }
                  <tr><td class="ps-3 text-muted">Less: refunds</td><td class="text-end text-muted">−{{ d.refunds | inr: true }}</td></tr>
                  <tr class="fw-bold"><td>Net revenue</td><td class="text-end">{{ d.netRevenue | inr: true }}</td></tr>
                  <tr><td>Cost of goods (vendor)</td><td class="text-end">−{{ d.costOfGoods | inr: true }}</td></tr>
                  @if (d.estimatedCostPortion > 0) { <tr><td class="ps-3 text-warning fs-8" colspan="2"><i class="bi bi-info-circle me-1"></i>{{ d.estimatedCostPortion | inr }} is estimated — add vendor bills for exact figures</td></tr> }
                  @if (d.otherPurchases > 0) { <tr><td class="ps-3 text-muted">incl. purchases not linked to orders</td><td class="text-end text-muted">{{ d.otherPurchases | inr: true }}</td></tr> }
                  <tr class="fw-bold"><td>Gross profit</td><td class="text-end">{{ d.grossProfit | inr: true }}</td></tr>
                  @for (e of d.expenses; track e.label) { <tr><td class="ps-3 text-muted">{{ e.label }}</td><td class="text-end text-muted">−{{ e.amount | inr: true }}</td></tr> }
                  <tr><td>Total operating expenses</td><td class="text-end">−{{ d.totalExpenses | inr: true }}</td></tr>
                  <tr class="fw-bold fs-6" [class.text-success]="d.netProfit >= 0" [class.text-danger]="d.netProfit < 0"><td>Net profit</td><td class="text-end">{{ d.netProfit | inr: true }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="col-xl-7">
          <div class="card h-100">
            <div class="card-header"><h5 class="mb-0">Monthly trend</h5></div>
            <div class="card-body"><wc-chart [option]="chart()" height="320px" /></div>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-header"><h5 class="mb-0">GST summary</h5></div>
            <div class="card-body fs-7">
              @if (d.gstRegistered) {
                <div class="d-flex justify-content-between mb-2"><span>Output GST (on sales)</span><b>{{ d.outputGst | inr: true }}</b></div>
                <div class="d-flex justify-content-between mb-2"><span>Input GST (vendor bills + expenses)</span><b>−{{ d.inputGst | inr: true }}</b></div>
                <div class="d-flex justify-content-between border-top pt-2 fs-6"><span>Net GST payable</span><b [class.text-danger]="d.netGstPayable > 0">{{ d.netGstPayable | inr: true }}</b></div>
              } @else {
                <p class="text-muted mb-0">You're not GST-registered, so customer invoices are issued as <b>Bills of Supply</b> and GST paid to the vendor is treated as part of the cost. Turn this on in <a routerLink="/settings">Business settings</a> once you register.</p>
              }
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card h-100">
            <div class="card-header"><h5 class="mb-0">Cash position</h5></div>
            <div class="card-body fs-7">
              <div class="d-flex justify-content-between mb-2"><span>Received from customers</span><b class="text-success">{{ d.cashReceived | inr }}</b></div>
              <div class="d-flex justify-content-between mb-2"><span>Paid to vendors</span><b>−{{ d.cashPaidToVendors | inr }}</b></div>
              <div class="d-flex justify-content-between mb-2"><span>Expenses paid</span><b>−{{ d.cashExpenses | inr }}</b></div>
              <div class="d-flex justify-content-between border-top pt-2 mb-3"><span>Net cash flow</span><b>{{ d.cashReceived - d.cashPaidToVendors - d.cashExpenses | inr }}</b></div>
              <div class="d-flex justify-content-between mb-1"><span class="text-muted">Receivable from customers (all time)</span><b>{{ d.receivables | inr }}</b></div>
              <div class="d-flex justify-content-between"><span class="text-muted">Payable to vendors (all time)</span><b class="text-danger">{{ d.payables | inr }}</b></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h5 class="mb-0">Profit by order</h5></div>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th>Order</th><th>Delivered</th><th>Customer</th><th class="text-end">Revenue (ex-GST)</th><th class="text-end">Cost</th><th class="text-end">Profit</th><th class="text-end">Margin</th></tr></thead>
            <tbody>
              @for (o of d.orders; track o.orderId) {
                <tr>
                  <td><a [routerLink]="['/orders', o.orderId]">#{{ o.orderNumber }}</a></td>
                  <td>{{ o.date | date: 'dd MMM yyyy' }}</td>
                  <td>{{ o.customer }}</td>
                  <td class="text-end">{{ o.revenue | inr: true }}</td>
                  <td class="text-end">{{ o.cost | inr: true }} @if (o.costIsEstimated) { <i class="bi bi-asterisk text-warning fs-8" title="Estimated — no vendor bill yet"></i> }</td>
                  <td class="text-end fw-bold" [class.text-danger]="o.profit < 0">{{ o.profit | inr: true }}</td>
                  <td class="text-end">{{ o.marginPercent }}%</td>
                </tr>
              } @empty { <tr><td colspan="7"><div class="empty-state"><i class="bi bi-graph-up"></i>No delivered orders in this period.</div></td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    }
  `
})
export class ProfitLossPage {
  protected api = inject(ApiService);
  protected d = signal<ProfitLoss | null>(null);
  preset = 'month';
  from = '';
  to = '';

  protected chart = computed<ChartOption>(() => {
    const m = this.d()?.monthly ?? [];
    return {
      color: [CHART_COLORS[0], '#E2D8CB', CHART_COLORS[2], CHART_COLORS[1]],
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => '₹' + Number(v).toLocaleString('en-IN') },
      legend: { top: 0, icon: 'circle', itemWidth: 8 },
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: m.map(x => x.month), axisLabel: { color: '#6B5A4E' } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#F3EEE7' } }, axisLabel: { color: '#6B5A4E' } },
      series: [
        { name: 'Revenue', type: 'bar', barGap: 0, data: m.map(x => x.revenue) },
        { name: 'Vendor cost', type: 'bar', data: m.map(x => x.cogs) },
        { name: 'Expenses', type: 'bar', data: m.map(x => x.expenses) },
        { name: 'Net profit', type: 'line', smooth: true, lineStyle: { width: 3 }, data: m.map(x => x.netProfit) }
      ]
    };
  });

  constructor() { this.applyPreset(); }

  applyPreset() {
    const now = new Date();
    let f: Date, t = now;
    switch (this.preset) {
      case 'last-month': f = new Date(now.getFullYear(), now.getMonth() - 1, 1); t = new Date(now.getFullYear(), now.getMonth(), 0); break;
      case 'quarter': f = new Date(now.getFullYear(), now.getMonth() - 2, 1); break;
      case 'fy': f = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1); break;
      case 'custom': this.load(); return;
      default: f = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    this.from = isoDate(f);
    this.to = isoDate(t);
    this.load();
  }

  load() {
    this.api.get<ProfitLoss>('admin/reports/profit-loss', { from: this.from, to: this.to }).subscribe(d => this.d.set(d));
  }

  toLabel(to: string) { return new Date(new Date(to).getTime() - 86400000); }
  print() { window.print(); }
}
