#!/bin/bash
# DB-003: create the runtime roles.
#   retail_migrate — owns tenant schemas, runs migrations/provisioning (tools only)
#   retail_app     — NOINHERIT connect role used by the API; gains tenant
#                    privileges ONLY via `SET LOCAL ROLE <tenant>_app` per transaction
#   t_<slug>_app   — per-tenant NOLOGIN DML roles, created at provisioning
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
DO \$do\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'retail_migrate') THEN
    CREATE ROLE retail_migrate LOGIN CREATEROLE PASSWORD '${POSTGRES_MIGRATE_PASSWORD}';
  ELSE
    EXECUTE format('ALTER ROLE retail_migrate LOGIN CREATEROLE PASSWORD %L', '${POSTGRES_MIGRATE_PASSWORD}');
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'retail_app') THEN
    CREATE ROLE retail_app LOGIN NOINHERIT PASSWORD '${POSTGRES_APP_PASSWORD}';
  ELSE
    EXECUTE format('ALTER ROLE retail_app LOGIN NOINHERIT PASSWORD %L', '${POSTGRES_APP_PASSWORD}');
  END IF;
END
\$do\$;

-- The migrate role creates tenant schemas, per-tenant roles and platform tables.
GRANT CREATE ON DATABASE ${POSTGRES_DB} TO retail_migrate;
GRANT CREATE ON SCHEMA public TO retail_migrate;
GRANT USAGE ON SCHEMA public TO retail_migrate;
EOSQL

