// Applied to EVERY tenant schema. Uses unqualified names — node-pg-migrate
// sets search_path to the target schema for the run.
exports.up = (pgm) => {
  pgm.createTable(
    "products",
    {
      id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
      name: { type: "text", notNull: true },
      sku: { type: "text", notNull: true, unique: true },
      price_cents: { type: "integer", notNull: true },
      stock: { type: "integer", notNull: true, default: 0 },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );
  pgm.createIndex("products", "name", { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable("products", { ifExists: true });
};
