import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, output, viewChild, computed } from '@angular/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export type ChartOption = echarts.EChartsCoreOption;

/** Thin ECharts wrapper; re-renders when the option input changes and resizes with its container. */
@Component({
  selector: 'wc-chart',
  template: `<div #host [style.height]="height()" class="w-100"></div>`
})
export class ChartComponent implements OnDestroy {
  readonly option = input.required<ChartOption>();
  readonly height = input('300px');
  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private chart?: echarts.ECharts;
  private observer?: ResizeObserver;

  constructor() {
    afterNextRender(() => {
      const dark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
      this.chart = echarts.init(this.host().nativeElement, dark ? 'dark' : undefined, { renderer: 'canvas' });
      this.chart.setOption({ backgroundColor: 'transparent', ...this.option() });
      this.observer = new ResizeObserver(() => this.chart?.resize());
      this.observer.observe(this.host().nativeElement);
    });
    effect(() => {
      const opt = this.option();
      this.chart?.setOption({ backgroundColor: 'transparent', ...opt }, true);
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.chart?.dispose();
  }
}

@Component({
  selector: 'wc-pager',
  template: `
    @if (total() > 0) {
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3">
        <span class="text-muted fs-7">
          {{ (page() - 1) * pageSize() + 1 }} to {{ min(page() * pageSize(), total()) }} <span class="text-quiet">of</span> {{ total() }}
        </span>
        <div class="btn-group">
          <button class="btn btn-sm btn-phoenix-secondary" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)"><i class="bi bi-chevron-left"></i></button>
          @for (p of pages(); track p) {
            <button class="btn btn-sm" [class.btn-primary]="p === page()" [class.btn-phoenix-secondary]="p !== page()" (click)="pageChange.emit(p)">{{ p }}</button>
          }
          <button class="btn btn-sm btn-phoenix-secondary" [disabled]="page() >= last()" (click)="pageChange.emit(page() + 1)"><i class="bi bi-chevron-right"></i></button>
        </div>
      </div>
    }
  `
})
export class PagerComponent {
  readonly page = input(1);
  readonly pageSize = input(25);
  readonly total = input(0);
  readonly pageChange = output<number>();
  readonly last = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly pages = computed(() => {
    const last = this.last(), cur = this.page();
    const start = Math.max(1, Math.min(cur - 2, last - 4));
    return Array.from({ length: Math.min(5, last) }, (_, i) => start + i);
  });
  min(a: number, b: number) { return Math.min(a, b); }
}

@Component({
  selector: 'wc-modal',
  template: `
    <div class="wc-modal-backdrop" (mousedown)="onBackdrop($event)">
      <div class="wc-modal" [class.lg]="size() === 'lg'" (mousedown)="$event.stopPropagation()">
        <div class="wc-modal-header">
          <h5 class="mb-0">{{ title() }}</h5>
          <button type="button" class="btn-close" aria-label="Close" (click)="closed.emit()"></button>
        </div>
        <div class="wc-modal-body"><ng-content /></div>
        <div class="wc-modal-footer"><ng-content select="[footer]" /></div>
      </div>
    </div>
  `
})
export class ModalComponent {
  readonly title = input('');
  readonly size = input<'md' | 'lg'>('md');
  readonly closed = output<void>();
  onBackdrop(e: MouseEvent) { if (e.target === e.currentTarget) this.closed.emit(); }
}

/** Phoenix-inspired default chart palette. */
export const CHART_COLORS = ['#3874ff', '#25b003', '#e5780b', '#0097eb', '#ed2000', '#85a9ff', '#90d67f', '#f8b96e'];
