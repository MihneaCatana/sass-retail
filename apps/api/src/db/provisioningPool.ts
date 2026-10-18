import path from "node:path";
import { Pool } from "pg";
import { createProvisioner, type Provisioner } from "@retail/provisioning";
import { env } from "../config/env";

/**
 * DEDICATED provisioning pool using the migrate role (schema owner, CREATEROLE).
 * Isolated from the request-path pool (app role) — DB-003. Only the onboarding
 * module may import this file.
 */
const migratePool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_MIGRATE_USER,
  password: env.POSTGRES_MIGRATE_PASSWORD,
  max: 2
});

const migrationsDir =
  env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "..", "..", "packages", "provisioning", "migrations");

function databaseUrl(): string {
  return `postgres://${encodeURIComponent(env.POSTGRES_MIGRATE_USER)}:${encodeURIComponent(
    env.POSTGRES_MIGRATE_PASSWORD ?? ""
  )}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`;
}

export const provisioning: Provisioner = createProvisioner({
  pool: migratePool,
  databaseUrl: databaseUrl(),
  migrationsDir,
  appConnectRole: env.POSTGRES_APP_USER
});
