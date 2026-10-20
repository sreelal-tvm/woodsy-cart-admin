import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Expense, ExpenseCategory } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES, isoDate } from '../../shared/pipes';
import { ModalComponent } from '../../shared/ui';

const CATEGORIES: ExpenseCategory[] = ['Marketing', 'Advertising', 'Packaging', 'Delivery', 'PaymentGatewayFees', 'SoftwareHosting', 'Salary', 'Rent', 'Utilities', 'Legal', 'Miscellaneous'];

@Component({
  selector: 'wc-expenses',
  imports: [FormsModule, DatePipe, ModalComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
      <h2 class="page-title mb-0">Expenses</h2>
      <button class="btn btn-sm btn-primary" (click)="edit(null)"><i class="bi bi-plus-lg me-1"></i>Add expense</button>
    </div>
    <p class="page-subtitle">Running costs such as ads, Razorpay fees, hosting and packaging. They're deducted in your P&amp;L.</p>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <select class="form-select form-select-sm w-auto" [(ngModel)]="category" (change)="load()">
        <option value="">All categories</option>@for (c of categories; track c) { <option [value]="c">{{ c | humanize }}</option> }
      </select>
      <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="from" (change)="load()" />
      <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="to" (change)="load()" />
    </div>

    <div class="row g-3">
      <div class="col-xl-9">
        <div class="card">
          <div class="table-responsive">
            <table class="table align-middle">
              <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid to</th><th class="text-end">Amount</th><th class="text-end">GST</th><th></th></tr></thead>
              <tbody>
                @for (e of items(); track e.id) {
                  <tr>
                    <td class="text-nowrap">{{ e.date | date: 'dd MMM yyyy' }}</td>
                    <td><span class="badge-soft badge-soft-primary">{{ e.category | humanize }}</span></td>
                    <td>{{ e.description }}@if (e.reference) { <div class="text-muted fs-8">Ref {{ e.reference }}</div> }</td>
                    <td>{{ e.paidTo || '—' }}</td>
                    <td class="text-end fw-bold">{{ e.amount | inr: true }}</td>
                    <td class="text-end">{{ e.gstAmount | inr: true }}</td>
                    <td class="text-end text-nowrap">
                      @if (e.receiptUrl) { <a class="btn btn-sm btn-phoenix-secondary btn-icon" [href]="e.receiptUrl | media" target="_blank" rel="noopener"><i class="bi bi-paperclip"></i></a> }
                      <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1" (click)="edit(e)"><i class="bi bi-pencil"></i></button>
                      <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1 text-danger" (click)="remove(e)"><i class="bi bi-trash"></i></button>
                    </td>
                  </tr>
                } @empty { <tr><td colspan="7"><div class="empty-state"><i class="bi bi-wallet2"></i>No expenses recorded.</div></td></tr> }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="col-xl-3">
        <div class="card">
          <div class="card-header"><h5 class="mb-0">Total {{ total() | inr }}</h5></div>
          <div class="list-group list-group-flush fs-7">
            @for (c of byCategory(); track c.category) {
              <div class="list-group-item d-flex justify-content-between"><span>{{ c.category | humanize }}</span><b>{{ c.amount | inr }}</b></div>
            }
          </div>
        </div>
      </div>
    </div>

    @if (form(); as f) {
      <wc-modal [title]="f.id ? 'Edit expense' : 'Add expense'" (closed)="form.set(null)">
        <div class="row g-2">
          <div class="col-6"><label class="form-label">Date</label><input type="date" class="form-control" [(ngModel)]="f.date" /></div>
          <div class="col-6"><label class="form-label">Category</label><select class="form-select" [(ngModel)]="f.category">@for (c of categories; track c) { <option [value]="c">{{ c | humanize }}</option> }</select></div>
          <div class="col-12"><label class="form-label">Description</label><input class="form-control" [(ngModel)]="f.description" /></div>
          <div class="col-6"><label class="form-label">Amount (ex-GST)</label><input type="number" class="form-control" [(ngModel)]="f.amount" /></div>
          <div class="col-6"><label class="form-label">GST</label><input type="number" class="form-control" [(ngModel)]="f.gstAmount" /></div>
          <div class="col-6"><label class="form-label">Paid to</label><input class="form-control" [(ngModel)]="f.paidTo" /></div>
          <div class="col-6"><label class="form-label">Payment mode</label><input class="form-control" [(ngModel)]="f.paymentMode" placeholder="UPI / card / bank" /></div>
          <div class="col-6"><label class="form-label">Reference</label><input class="form-control" [(ngModel)]="f.reference" /></div>
          <div class="col-6"><label class="form-label">Receipt</label><input type="file" class="form-control" accept=".pdf,image/*" (change)="upload($event)" /></div>
        </div>
        <ng-container footer><button class="btn btn-phoenix-secondary" (click)="form.set(null)">Close</button><button class="btn btn-primary" [disabled]="!f.description || !f.amount" (click)="save()">Save</button></ng-container>
      </wc-modal>
    }
  `
})
export class ExpensesPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected categories = CATEGORIES;
  protected items = signal<Expense[]>([]);
  protected total = signal(0);
  protected byCategory = signal<{ category: string; amount: number }[]>([]);
  protected form = signal<Expense | null>(null);
  category = ''; from = ''; to = '';

  constructor() { this.load(); }

  load() {
    this.api.get<{ items: Expense[]; total: number; byCategory: { category: string; amount: number }[] }>('admin/expenses', { category: this.category, from: this.from, to: this.to })
      .subscribe(r => { this.items.set(r.items); this.total.set(r.total); this.byCategory.set(r.byCategory); });
  }

  edit(e: Expense | null) {
    this.form.set(e ? { ...e, date: e.date.slice(0, 10) } : { id: 0, date: isoDate(new Date()), category: 'Advertising', description: '', amount: 0, gstAmount: 0 });
  }

  upload(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.upload<{ url: string }>('admin/uploads', file, 'file', { folder: 'receipts' }).subscribe(r => this.form.update(f => f ? { ...f, receiptUrl: r.url } : f));
  }

  save() {
    const f = this.form()!;
    const req = f.id ? this.api.put(`admin/expenses/${f.id}`, f) : this.api.post('admin/expenses', f);
    req.subscribe(() => { this.form.set(null); this.toast.success('Expense saved'); this.load(); });
  }

  remove(e: Expense) {
    if (!confirm('Delete this expense?')) return;
    this.api.delete(`admin/expenses/${e.id}`).subscribe(() => this.load());
  }
}
