import { Service, inject, Signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Product, StockMovement, StockMovementInput, StockMovementPage } from '@retail/shared-types';

@Service()
export class InventoryData {
  private readonly http = inject(HttpClient);
  product(id: Signal<string>) { return httpResource<Product>(() => `/api/products/${id()}`); }
  history(id: Signal<string>, page: Signal<number>) {
    return httpResource<StockMovementPage>(() => `/api/products/${id()}/movements?page=${page()}&pageSize=20`);
  }
  move(id: string, body: StockMovementInput) {
    return firstValueFrom(this.http.post<StockMovement>(`/api/products/${id}/movements`, body));
  }
  reverse(id: string, movementId: string, reason: string, idempotencyKey: string) {
    return firstValueFrom(this.http.post<StockMovement>(`/api/products/${id}/movements/${movementId}/reverse`, { reason, idempotencyKey }));
  }
}
