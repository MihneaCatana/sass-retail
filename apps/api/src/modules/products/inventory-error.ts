export class InventoryError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
  }
}
