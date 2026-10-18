import path from "node:path";
import type { Env } from "@retail/env";
import dotenv from "dotenv";

// Host-run convenience: load the repo-root .env (no-op inside containers,
// where configuration comes exclusively from the environment).
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });

// A static `export ... from "@retail/env"` would hoist the module evaluation
// BEFORE dotenv.config() runs (ESM->CJS transform order), so require it here,
// in statement order. @retail/env validates process.env at module load.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const envModule = require("@retail/env") as typeof import("@retail/env");

export const env = envModule.env;
export const loadEnv = envModule.loadEnv;
export type { Env };

/**
 * Fails fast when a credential/setting this entrypoint needs is missing.
 * Each entrypoint (API server, migrate job) declares exactly the credentials
 * it requires — least privilege by construction (DB-003).
 */
export function requireEnvVar<K extends keyof Env>(name: K): void {
  const value = env[name];
  if (value === undefined || String(value) === "") {
    console.error(`${String(name)} is required`);
    process.exit(1);
  }
}


