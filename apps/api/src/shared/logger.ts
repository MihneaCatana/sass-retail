import pino from "pino";
import pretty from "pino-pretty";
import { env } from "../config/env";

/**
 * pino-pretty is used as a plain (synchronous) stream instead of a pino
 * "transport": transports spawn worker threads that cannot resolve the pretty
 * module inside the esbuild bundle. A plain stream bundles fine.
 */
export const logger = pino(
  { level: env.NODE_ENV === "development" ? "debug" : "info" },
  env.NODE_ENV === "development"
    ? pretty({ colorize: true, translateTime: "SYS:HH:MM:ss" })
    : undefined
);

