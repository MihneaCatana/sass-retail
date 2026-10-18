import { pool } from "../src/lib/db";
import { provisioning } from "../src/lib/provisioning";

async function main(): Promise<void> {
  await provisioning.runPlatformMigrations();
  console.log("Platform migrations applied.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
