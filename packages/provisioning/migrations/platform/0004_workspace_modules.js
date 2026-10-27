exports.up = (pgm) => {
  pgm.createTable(
    "tenant_module_entitlements",
    {
      tenant_id: {
        type: "uuid",
        notNull: true,
        references: "tenants(id)",
        onDelete: "cascade"
      },
      module_key: {
        type: "text",
        notNull: true,
        check: "module_key IN ('inventory', 'sales', 'sales-insights')"
      },
      enabled: { type: "boolean", notNull: true, default: true },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
    },
    { ifNotExists: true }
  );
  pgm.addConstraint("tenant_module_entitlements", "tenant_module_entitlements_pkey", {
    primaryKey: ["tenant_id", "module_key"]
  });

  // Preserve today's access for every existing workspace.
  pgm.sql(`
    INSERT INTO public.tenant_module_entitlements (tenant_id, module_key, enabled)
    SELECT tenants.id, modules.module_key, true
    FROM public.tenants
    CROSS JOIN unnest(ARRAY['inventory', 'sales', 'sales-insights']::text[]) AS modules(module_key)
    ON CONFLICT (tenant_id, module_key) DO NOTHING
  `);

  // The API may read grants directly. Changes go through a narrow function so
  // the runtime role cannot write arbitrary platform tables.
  pgm.sql("GRANT SELECT ON public.tenant_module_entitlements TO retail_app");
  pgm.sql(`
    CREATE FUNCTION public.set_tenant_module_entitlements(p_tenant_id uuid, p_enabled_modules text[])
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
    DECLARE
      allowed_modules constant text[] := ARRAY['inventory', 'sales', 'sales-insights']::text[];
    BEGIN
      IF p_enabled_modules IS NULL
        OR array_position(p_enabled_modules, NULL) IS NOT NULL
        OR NOT (p_enabled_modules <@ allowed_modules) THEN
        RAISE EXCEPTION 'Invalid workspace module set' USING ERRCODE = '22023';
      END IF;

      INSERT INTO public.tenant_module_entitlements (tenant_id, module_key, enabled, updated_at)
      SELECT p_tenant_id, module_key, module_key = ANY(p_enabled_modules), now()
      FROM unnest(allowed_modules) AS modules(module_key)
      ON CONFLICT (tenant_id, module_key) DO UPDATE
      SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found' USING ERRCODE = 'P0002';
      END IF;
    END;
    $$
  `);
  pgm.sql("REVOKE ALL ON FUNCTION public.set_tenant_module_entitlements(uuid, text[]) FROM PUBLIC");
  pgm.sql("GRANT EXECUTE ON FUNCTION public.set_tenant_module_entitlements(uuid, text[]) TO retail_app");
};

exports.down = (pgm) => {
  pgm.sql("REVOKE EXECUTE ON FUNCTION public.set_tenant_module_entitlements(uuid, text[]) FROM retail_app");
  pgm.sql("DROP FUNCTION IF EXISTS public.set_tenant_module_entitlements(uuid, text[])");
  pgm.dropTable("tenant_module_entitlements", { ifExists: true });
};
