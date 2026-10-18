import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { errorHandler, notFoundHandler } from "./errorHandler";

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
  return res as unknown as Response;
}

function mockReq(path = "/"): Request {
  return { path } as unknown as Request;
}

describe("errorHandler", () => {
  it("maps invalid JSON bodies to 400", () => {
    const res = mockRes();
    const err = new SyntaxError("Unexpected token");
    (err as unknown as { body: unknown }).body = {};

    errorHandler(err, mockReq("/api/x"), res, (() => undefined) as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid JSON body" });
  });

  it("returns a generic 500 (never leaks internals) and logs", () => {
    const res = mockRes();
    const secretError = new Error("postgres password is wrong");

    errorHandler(secretError, mockReq("/api/x"), res, (() => undefined) as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("404 handler reports the path", () => {
    const res = mockRes();

    notFoundHandler(mockReq("/api/nope"), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found", path: "/api/nope" });
  });
});
