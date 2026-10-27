exports.up = (pgm) => {
  pgm.createTable('sales', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    reference: { type: 'text', notNull: true, unique: true },
    status: { type: 'text', notNull: true, check: "status IN ('draft','completed','partially_returned','returned','cancelled','discarded')" },
    revision: { type: 'integer', notNull: true, default: 1 },
    price_basis: { type: 'text', notNull: true, check: "price_basis IN ('unspecified','tax_inclusive','tax_exclusive')" },
    note: { type: 'text', notNull: true, default: '' },
    actor: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('clock_timestamp()') },
    completed_at: { type: 'timestamptz' },
    total_cents: { type: 'bigint', notNull: true, default: 0 },
    returned_cents: { type: 'bigint', notNull: true, default: 0 },
    lines: { type: 'jsonb', notNull: true, default: '[]' }
  });
  pgm.addConstraint('sales', 'sales_amount_bounds', { check: 'total_cents >= 0 AND returned_cents >= 0 AND returned_cents <= total_cents' });
  pgm.createTable('sale_product_links', {
    sale_id: { type: 'uuid', notNull: true, references: 'sales', onDelete: 'RESTRICT' },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'RESTRICT' }
  });
  pgm.addConstraint('sale_product_links', 'sale_product_links_pk', { primaryKey: ['sale_id', 'product_id'] });
  pgm.createTable('sale_returns', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    sale_id: { type: 'uuid', notNull: true, references: 'sales', onDelete: 'RESTRICT' },
    kind: { type: 'text', notNull: true, check: "kind IN ('return','cancel')" },
    reason: { type: 'text', notNull: true }, actor: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('clock_timestamp()') },
    total_cents: { type: 'bigint', notNull: true }, lines: { type: 'jsonb', notNull: true }
  });
  pgm.createTable('sale_operations', {
    idempotency_key: { type: 'uuid', primaryKey: true },
    sale_id: { type: 'uuid', notNull: true, references: 'sales', onDelete: 'RESTRICT' },
    fingerprint: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('clock_timestamp()') }
  });
  pgm.createTable('product_cost_versions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'RESTRICT' },
    unit_cost_cents: { type: 'integer', notNull: true, check: 'unit_cost_cents >= 0' },
    price_basis: { type: 'text', notNull: true, check: "price_basis IN ('unspecified','tax_inclusive','tax_exclusive')" },
    effective_at: { type: 'timestamptz', notNull: true },
    source: { type: 'text', notNull: true, check: "source IN ('purchase','production','service','estimate')" },
    note: { type: 'text', notNull: true, default: '' }, actor: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('clock_timestamp()') }
  });
  pgm.addColumns('stock_movements', {
    sale_id: { type: 'uuid', references: 'sales', onDelete: 'RESTRICT' },
    sale_line_id: { type: 'uuid' },
    sale_return_id: { type: 'uuid', references: 'sale_returns', onDelete: 'RESTRICT' }
  });
  pgm.createIndex('sales', ['created_at', 'id']);
  pgm.createIndex('sale_returns', ['sale_id', 'created_at']);
  pgm.createIndex('sale_product_links', 'product_id');
  pgm.createIndex('product_cost_versions', ['product_id', 'effective_at']);
};
exports.down = () => { throw new Error('Sales migration is forward-only: sale and cost history must be preserved.'); };
