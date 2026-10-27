exports.up = (pgm) => {
  pgm.alterColumn('products', 'stock', { type: 'numeric(15,3)', using: 'stock::numeric(15,3)' });
  pgm.createTable('stock_movements', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    product_id: { type: 'uuid', notNull: true, references: 'products', onDelete: 'RESTRICT' },
    kind: { type: 'text', notNull: true, check: "kind IN ('opening','receive','consume','waste','adjust','reversal')" },
    delta: { type: 'numeric(15,3)', notNull: true },
    before_quantity: { type: 'numeric(15,3)', notNull: true },
    after_quantity: { type: 'numeric(15,3)', notNull: true },
    unit_type: { type: 'text', notNull: true },
    reason: { type: 'text', notNull: true },
    actor: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('clock_timestamp()') },
    reversal_of: { type: 'uuid', references: 'stock_movements', unique: true },
    idempotency_key: { type: 'uuid', unique: true },
    request_fingerprint: { type: 'text' }
  });
  pgm.addConstraint('stock_movements', 'stock_movement_balances', {
    check: 'after_quantity = before_quantity + delta AND before_quantity >= 0 AND after_quantity >= 0 AND after_quantity <= 1000000'
  });
  pgm.addConstraint('products', 'product_stock_bounds', { check: 'stock >= 0 AND stock <= 1000000' });
  pgm.createIndex('stock_movements', ['product_id', 'created_at', 'id']);
  pgm.sql(`INSERT INTO stock_movements(product_id,kind,delta,before_quantity,after_quantity,unit_type,reason,actor)
    SELECT id,'opening',stock,0,stock,unit_type,'Migrated opening balance','system:migration:0004' FROM products`);
  // Preserve evidence of historical service quantities, then explicitly neutralize
  // them. These migration entries are never offered as reversible user actions.
  pgm.sql(`INSERT INTO stock_movements(product_id,kind,delta,before_quantity,after_quantity,unit_type,reason,actor)
    SELECT id,'adjust',-stock,stock,0,unit_type,'Legacy service stock neutralized; original value retained in opening snapshot','system:migration:0004'
    FROM products WHERE product_type='service' AND stock <> 0`);
  pgm.sql("UPDATE products SET stock=0 WHERE product_type='service'");
};

exports.down = () => {
  throw new Error('Stock history migration is forward-only: restore a verified backup or roll forward; history must not be dropped.');
};
