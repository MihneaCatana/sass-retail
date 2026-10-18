import { pool } from "../src/lib/db";
import { provisioning } from "../src/lib/provisioning";

/** Applies tenant migrations to every registered tenant schema. */
async function main(): Promise<void> {
  const applied = await provisioning.migrateAllTenants();
  console.log(`Platform migrations + ${applied.length} tenant schemas applied.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

