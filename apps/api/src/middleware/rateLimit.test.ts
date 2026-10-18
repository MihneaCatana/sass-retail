import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { rateLimit } from "./rateLimit";

function mockReq(ip: string): Request {
  return { ip } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
  return res as unknown as Response;
}

describe("rateLimit", () => {
  it("allows up to max requests per IP, then 429", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 3 });
    const next = vi.fn();

    for (let i = 0; i < 3; i++) {
      middleware(mockReq("1.2.3.4"), mockRes(), next);
    }
    expect(next).toHaveBeenCalledTimes(3);

    const res = mockRes();
    middleware(mockReq("1.2.3.4"), res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it("tracks IPs independently", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1 });
    const next = vi.fn();

    middleware(mockReq("1.1.1.1"), mockRes(), next);
    middleware(mockReq("2.2.2.2"), mockRes(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("resets the window after it elapses", () => {
    vi.useFakeTimers();
    const middleware = rateLimit({ windowMs: 1_000, max: 1 });
    const next = vi.fn();

    middleware(mockReq("5.5.5.5"), mockRes(), next);
    vi.advanceTimersByTime(1_100);
    middleware(mockReq("5.5.5.5"), mockRes(), next);

    expect(next).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
