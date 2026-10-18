import path from "node:path";
import { env } from "./env";
import { databaseUrl, pool } from "./db";
import { createProvisioner } from "@retail/provisioning";

/**
 * Tools-side provisioner: runs as the migrate role (DDL allowed).
 * The migrations live in packages/provisioning — a single source of truth
 * shared with the API's onboarding module.
 */
export const provisioning = createProvisioner({
  pool,
  databaseUrl: databaseUrl(),
  migrationsDir: path.resolve(__dirname, "..", "..", "..", "packages", "provisioning", "migrations"),
  appConnectRole: env.POSTGRES_APP_USER
});
