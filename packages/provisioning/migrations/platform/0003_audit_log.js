// Platform audit trail for security-relevant platform operations (tenant
// lifecycle, user provisioning). The app role may append but not modify.
exports.up = (pgm) => {
  pgm.createTable(
    "audit_log",
    {
      id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
      occurred_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
      actor: { type: "text", notNull: true },
      action: { type: "text", notNull: true },
      details: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") }
    },
    { ifNotExists: true }
  );
  pgm.createIndex("audit_log", "occurred_at", { ifNotExists: true });
  pgm.sql("GRANT SELECT, INSERT ON public.audit_log TO retail_app");
};

exports.down = (pgm) => {
  pgm.dropTable("audit_log", { ifExists: true });
};
