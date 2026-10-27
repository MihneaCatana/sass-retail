import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Sale, SaleDraftInput, SaleReturnInput, CostVersion, CostVersionInput } from '@retail/shared-types';

@Service()
export class SalesData {
  private readonly http = inject(HttpClient);
  draft(body: SaleDraftInput, id?: string) {
    return firstValueFrom(id ? this.http.put<Sale>(`/api/sales/${id}`, body) : this.http.post<Sale>('/api/sales', body));
  }
  complete(id: string, revision: number, idempotencyKey: string) {
    return firstValueFrom(this.http.post<Sale>(`/api/sales/${id}/complete`, { revision, idempotencyKey }));
  }
  discard(id: string, revision: number) { return firstValueFrom(this.http.post(`/api/sales/${id}/discard`, { revision })); }
  returns(id: string, body: SaleReturnInput) { return firstValueFrom(this.http.post(`/api/sales/${id}/returns`, body)); }
  cancel(id: string, reason: string, restock: boolean, idempotencyKey: string) {
    return firstValueFrom(this.http.post(`/api/sales/${id}/cancel`, { reason, restock, idempotencyKey }));
  }
  cost(id: string, body: CostVersionInput) { return firstValueFrom(this.http.post<CostVersion>(`/api/products/${id}/costs`, body)); }
}
