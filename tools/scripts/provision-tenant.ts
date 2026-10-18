import { pool } from "../src/lib/db";
import { provisioning } from "../src/lib/provisioning";

async function main(): Promise<void> {
  const [slug, name, plan] = process.argv.slice(2);
  if (!slug || !name) {
    console.error("Usage: pnpm --filter @retail/tools provision <slug> <name> [plan]");
    process.exit(1);
  }

  const result = await provisioning.provisionTenant({ slug, name, plan });
  console.log(`Tenant "${slug}" provisioned: schema=${result.schema} id=${result.id}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
