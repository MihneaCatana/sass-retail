// Applied to EVERY tenant schema. Uses unqualified names — node-pg-migrate
// sets search_path to the target schema for the run.
exports.up = (pgm) => {
  pgm.createTable(
    "app_settings",
    {
      key: { type: "text", primaryKey: true },
      value: { type: "jsonb", notNull: true },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );
};

exports.down = (pgm) => {
  pgm.dropTable("app_settings", { ifExists: true });
};
