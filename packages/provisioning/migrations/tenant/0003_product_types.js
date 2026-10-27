exports.up = (pgm) => {
  // Idempotent follow-up to 0002 for databases where the products table was
  // already created before unit/product types were introduced.
  pgm.addColumns(
    "products",
    {
      unit_type: { type: "text", notNull: true, default: "unit" },
      product_type: { type: "text", notNull: true, default: "endproduct" }
    },
    { ifNotExists: true }
  );
};