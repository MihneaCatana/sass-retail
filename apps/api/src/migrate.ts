import { provisioning } from "./db/provisioningPool";
import { requireEnvVar } from "./config/env";

/**
 * Deploy-time migration step: applies platform migrations, then tenant
 * migrations to every registered tenant schema. Runs as the migrate role.
 * Exits non-zero on failure so the compose `migrations` service fails loudly.
 */
function main(): void {
  requireEnvVar("POSTGRES_MIGRATE_PASSWORD");
  run();
}

async function run(): Promise<void> {
  const applied = await provisioning.migrateAllTenants();
  console.log(`Migrations applied (platform + ${applied.length} tenant schemas).`);
  process.exit(0);
}

main();

