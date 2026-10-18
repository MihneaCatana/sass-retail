// DB-003: the API (app role) may READ the tenant registry but never write it.
// Requires the retail_app role to exist (created by infrastructure/postgres/init/02-roles.sh).
exports.up = (pgm) => {
  pgm.sql("GRANT SELECT ON public.tenants TO retail_app");
  // Future platform tables created by the migrate role: app gets read access.
  pgm.sql("ALTER DEFAULT PRIVILEGES FOR ROLE retail_migrate IN SCHEMA public GRANT SELECT ON TABLES TO retail_app");
};

exports.down = (pgm) => {
  pgm.sql("REVOKE SELECT ON public.tenants FROM retail_app");
};
