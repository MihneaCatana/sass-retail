import path from "node:path";
import dotenv from "dotenv";

// Tools run from the tools/ package directory — load the repo-root .env.
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

// A static `export ... from "@retail/env"` would hoist the module evaluation
// BEFORE dotenv.config() runs (ESM->CJS transform order), so require it here,
// in statement order. @retail/env validates process.env at module load.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const envModule = require("@retail/env") as typeof import("@retail/env");

// Tools hold the migrate-role credentials (they run DDL). Never expose them
// to the API (DB-003 least privilege).
if (!envModule.env.POSTGRES_MIGRATE_PASSWORD) {
   
  console.error("POSTGRES_MIGRATE_PASSWORD is required for tools");
  process.exit(1);
}

// Narrow the optional field to `string` — the guard above guarantees presence.
export const env = {
  ...envModule.env,
  POSTGRES_MIGRATE_PASSWORD: envModule.env.POSTGRES_MIGRATE_PASSWORD as string
};
export type { Env } from "@retail/env";
