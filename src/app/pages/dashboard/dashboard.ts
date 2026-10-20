import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Dashboard, DashboardOffer } from '../../core/models';
import { SHARED_PIPES, isoDate } from '../../shared/pipes';
import { CHART_COLORS, ChartComponent, ChartOption } from '../../shared/ui';

@Component({
  selector: 'wc-dashboard',
  imports: [ChartComponent, RouterLink, DatePipe, FormsModule, ...SHARED_PIPES],
  templateUrl: './dashboard.html'
})
export class DashboardPage {
  private api = inject(ApiService);
  protected data = signal<Dashboard | null>(null);
  protected range = signal('30');

  protected salesChart = computed<ChartOption>(() => {
    const d = this.data();
    const s = d?.salesSeries ?? [];
    return {
      color: [CHART_COLORS[0], '#cbd0dd'],
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => '₹' + Number(v).toLocaleString('en-IN') },
      legend: { data: ['This period', 'Previous period'], top: 0, right: 0, icon: 'circle', itemWidth: 8 },
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: s.map(p => p.label), boundaryGap: false, axisLine: { lineStyle: { color: '#e3e6ed' } }, axisLabel: { color: '#6e7891' } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eff2f6' } }, axisLabel: { color: '#6e7891', formatter: (v: number) => (v >= 1000 ? v / 1000 + 'k' : v) } },
      series: [
        { name: 'This period', type: 'line', smooth: true, showSymbol: false, lineStyle: { width: 3 }, areaStyle: { opacity: 0.08 }, data: s.map(p => p.value) },
        { name: 'Previous period', type: 'line', smooth: true, showSymbol: false, lineStyle: { type: 'dashed', width: 2 }, data: s.map(p => p.value2) }
      ]
    };
  });

  protected categoryChart = computed<ChartOption>(() => {
    const c = this.data()?.salesByCategory ?? [];
    return {
      color: [CHART_COLORS[0]],
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => '₹' + Number(v).toLocaleString('en-IN') },
      grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#eff2f6' } }, axisLabel: { color: '#6e7891' } },
      yAxis: { type: 'category', data: c.map(x => x.name).reverse(), axisLabel: { color: '#6e7891' } },
      series: [{ type: 'bar', barWidth: 12, itemStyle: { borderRadius: [0, 4, 4, 0] }, data: c.map(x => x.value).reverse() }]
    };
  });

  protected paymentChart = computed<ChartOption>(() => this.donut(this.data()?.paymentMethods ?? []));
  protected statusChart = computed<ChartOption>(() => this.donut(this.data()?.statusBreakdown ?? [], true));

  constructor() { this.load(); }

  load() {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - Number(this.range()) + 1);
    this.api.get<Dashboard>('admin/reports/dashboard', { from: isoDate(from), to: isoDate(to) }).subscribe(d => this.data.set(d));
  }

  offerStatusLabel(s: DashboardOffer['status']) { return { live: 'Live now', upcoming: 'Scheduled', ended: 'Ended', off: 'Off' }[s]; }
  offerStatusClass(s: DashboardOffer['status']) {
    return { live: 'badge-soft-success', upcoming: 'badge-soft-info', ended: 'badge-soft-secondary', off: 'badge-soft-warning' }[s];
  }

  /** "Ends in 3 days" / "Starts tomorrow" / "Ended 5 days ago". */
  offerTiming(o: DashboardOffer): string {
    const now = Date.now();
    const days = (iso: string) => Math.round(Math.abs(new Date(iso).getTime() - now) / 86_400_000);
    const when = (n: number, past = false) => n === 0 ? 'today' : n === 1 ? (past ? 'yesterday' : 'tomorrow') : past ? `${n} days ago` : `in ${n} days`;
    if (o.status === 'upcoming') return 'Starts ' + when(days(o.startsAt));
    if (o.status === 'live') return 'Ends ' + when(days(o.endsAt));
    return 'Ended ' + when(days(o.endsAt), true);
  }

  private donut(items: { name: string; value: number; count: number }[], byCount = false): ChartOption {
    return {
      color: CHART_COLORS,
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, icon: 'circle', itemWidth: 8, textStyle: { color: '#6e7891' } },
      series: [{
        type: 'pie', radius: ['55%', '78%'], center: ['50%', '42%'], avoidLabelOverlap: true, label: { show: false },
        data: items.map(i => ({ name: i.name.replace(/([a-z])([A-Z])/g, '$1 $2'), value: byCount ? i.count : i.value }))
      }]
    };
  }
}
