import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { requireRole } from "./requireRole";


function mockReq(auth?: { sub: string; roles: string[] }): Request {
  return { auth } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
  return res as unknown as Response;
}

describe("requireRole", () => {
  const next = vi.fn();

  beforeEach(() => {
    next.mockClear();
  });

  it("401s when there is no verified identity on the request", () => {
    const middleware = requireRole("platform-admin");
    const res = mockRes();

    middleware(mockReq(undefined), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("403s when the verified identity lacks the required role", () => {
    const middleware = requireRole("platform-admin");
    const res = mockRes();

    middleware(mockReq({ sub: "user-1", roles: ["tenant-user"] }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Requires the "platform-admin" role' });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the role is present", () => {
    const middleware = requireRole("platform-admin");

    middleware(mockReq({ sub: "user-1", roles: ["platform-admin", "tenant-admin"] }), mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
