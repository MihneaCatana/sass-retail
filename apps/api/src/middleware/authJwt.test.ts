import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('jose', () => ({ createRemoteJWKSet: vi.fn(), jwtVerify: verify }));
import { authJwt } from './authJwt';

describe('authJwt subject requirement', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([undefined, '', '   ', 42])('rejects a verified token without a valid subject (%s)', async (sub) => {
    verify.mockResolvedValue({ payload: { sub } });
    const req = { headers: { authorization: 'Bearer test-token' } } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await authJwt(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.auth).toBeUndefined();
  });
  it('retains only the verified subject as the actor', async () => {
    verify.mockResolvedValue({ payload: { sub: 'verified-user', tenant_slug: 'acme', realm_access: { roles: ['tenant-admin'] } } });
    const req = { headers: { authorization: 'Bearer test-token' } } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await authJwt(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth?.sub).toBe('verified-user');
  });
});
