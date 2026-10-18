-- One-time dev-database fixup for DB-003 (runs as the bootstrap superuser).
-- Fresh environments get the same effect via init/02-roles.sh + provisioning.
-- Idempotent: safe to re-run.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'retail_migrate') THEN
    CREATE ROLE retail_migrate LOGIN CREATEROLE PASSWORD 'retail-migrate-dev-password';
  ELSE
    EXECUTE format('ALTER ROLE retail_migrate LOGIN CREATEROLE PASSWORD %L', 'retail-migrate-dev-password');
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'retail_app') THEN
    CREATE ROLE retail_app LOGIN NOINHERIT PASSWORD 'retail-app-dev-password';
  ELSE
    EXECUTE format('ALTER ROLE retail_app LOGIN NOINHERIT PASSWORD %L', 'retail-app-dev-password');
  END IF;
END
$do$;

GRANT CREATE ON DATABASE retail TO retail_migrate;
GRANT CREATE ON SCHEMA public TO retail_migrate;
GRANT USAGE ON SCHEMA public TO retail_migrate;

DO $fix$
DECLARE s text; t text; r text;
BEGIN
  -- Per-tenant NOLOGIN role per schema, with rights on THAT schema only.
  FOR s IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 't\_%' ESCAPE '\' LOOP
    r := s || '_app';

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;

    EXECUTE format('ALTER SCHEMA %I OWNER TO retail_migrate', s);
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = s AND tablename <> 'pgmigrations' LOOP
      EXECUTE format('ALTER TABLE %I.%I OWNER TO retail_migrate', s, t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO %I', s, t, r);
    END LOOP;
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', s, r);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE retail_migrate IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', s, r);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE retail_migrate IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I', s, r);

    -- The API connect role must be able to SET ROLE into the tenant role.
    EXECUTE format('GRANT %I TO retail_app', r);
    -- The migrate role administers tenant roles (drop on tenant deletion).
    EXECUTE format('GRANT %I TO retail_migrate WITH ADMIN OPTION', r);

    -- Remove the earlier WRONG model: direct grants to retail_app.
    EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I FROM retail_app', s);
    EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM retail_app', s);
  END LOOP;

  ALTER TABLE public.tenants OWNER TO retail_migrate;
  ALTER TABLE public.platform_migrations OWNER TO retail_migrate;
  -- The registry is the ONLY thing the app role reads directly.
  GRANT SELECT ON public.tenants TO retail_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE retail_migrate IN SCHEMA public GRANT SELECT ON TABLES TO retail_app;
END
$fix$;
