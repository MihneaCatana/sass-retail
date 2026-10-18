import { Router } from "express";
import { pool } from "../db/pool";

export const healthRouter = Router();

healthRouter.get("/live", (_req, res) => {
  res.json({ status: "ok" });
});

healthRouter.get("/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", checks: { db: "ok" } });
  } catch {
    res.status(503).json({ status: "error", checks: { db: "unavailable" } });
  }
});

