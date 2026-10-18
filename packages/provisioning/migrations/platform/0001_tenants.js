exports.up = (pgm) => {
  pgm.createTable(
    "tenants",
    {
      id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
      slug: { type: "text", notNull: true, unique: true },
      schema_name: { type: "text", notNull: true, unique: true },
      name: { type: "text", notNull: true },
      status: { type: "text", notNull: true, default: "active", check: "status IN ('active', 'suspended')" },
      plan: { type: "text", notNull: true, default: "free" },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );
  pgm.createIndex("tenants", "status", { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable("tenants", { ifExists: true });
};
